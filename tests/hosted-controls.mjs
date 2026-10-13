// Hosted check for the October 13 release: a fresh, unpaired profile per
// width, so nothing here can reach a real archive or vault. Every request
// that leaves the site's own origin is refused.
// BASE=https://… node tests/hosted-controls.mjs
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:4173'
const expectSw = process.env.SW || 'v42'
const browser = await chromium.launch()
try {
  for (const width of [1440, 1180, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width >= 1200 ? 900 : 844 } })
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
    )
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE + '/')
    assert.equal(await page.evaluate(() => localStorage.getItem('field-notes.vault')), null, 'unpaired')
    const pill = page.getByRole('navigation', { name: 'Primary navigation' })
    await pill.waitFor()
    for (const [room, path] of [
      ['Workshop', /^\/workshop$/],
      ['Calendar', /^\/calendar/],
      ['From Siena', /^\/from-siena$/],
      ['Notebooks', /^\/n\//],
      ['Today', /^\/overview$/],
    ]) {
      await page.mouse.move(width / 2, 10)
      await pill.getByRole('link', { name: room, exact: true }).click()
      await page.waitForURL((u) => path.test(u.pathname))
    }
    await page.mouse.move(width / 2, 10)
    await pill.getByRole('link', { name: 'Notebooks', exact: true }).click()
    await page.waitForURL(/\/n\//)
    const notebook = new URL(page.url()).pathname
    await page.mouse.move(width / 2, 10)
    await pill.getByRole('button', { name: 'New page' }).click()
    await page.waitForURL(/\/p\//)
    const line = `Hosted check ${width} ${Date.now()}`
    await page.locator('.cm-content').click()
    await page.keyboard.type(line)
    await page.waitForTimeout(900)
    await page.reload()
    await page.locator('.cm-content').getByText(line).waitFor()
    await page.mouse.move(width / 2, 10)
    await pill.getByRole('button', { name: 'Up' }).click()
    await page.waitForURL((u) => u.pathname === notebook)
    const sw = await page.evaluate(async () => {
      const text = await (await fetch('/sw.js', { cache: 'no-store' })).text()
      return /VERSION = '([^']+)'/.exec(text)?.[1]
    })
    assert.equal(sw, expectSw, 'service worker version')
    assert.deepEqual(errors, [], 'no runtime errors')
    console.log(`PASS ${width}px hosted: rooms, + new page, save and reload, up, ${sw}`)
    await context.close()
  }
} finally {
  await browser.close()
}
