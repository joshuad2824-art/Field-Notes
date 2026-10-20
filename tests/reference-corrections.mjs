import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
mkdirSync('work/2026-10-12-reference-corrections', { recursive: true })
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188'
const b = await chromium.launch()
try {
  for (const width of [1440, 820, 390, 320]) {
    const c = await b.newContext({ viewport: { width, height: 900 } })
    await c.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
    )
    const p = await c.newPage()
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    await p.goto(BASE + '/tests/redesign-check.html')
    await p.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await p.getByText('Fixtures ready').waitFor()
    for (const route of ['/', '/workshop', '/calendar/2026-10']) {
      await p.goto(BASE + route)
      await p.evaluate(() => document.fonts.ready)
      await p.waitForTimeout(300)
      await p.screenshot({
        path: `work/2026-10-12-reference-corrections/${width}-${route === '/' ? 'today' : route.split('/')[1]}.png`,
        fullPage: true,
      })
      assert.ok(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route + ' overflow',
      )
      if (route === '/') {
        assert.equal(await p.locator('.week-strip').count(), 0)
        assert.equal(await p.locator('.board-books small').count(), 0)
        assert.equal(await p.locator('.quiet-day').count(), 0)
        const square = await p.locator('.board-month').boundingBox()
        /* October 13, second pass: on a phone the card is as tall as its
           weeks, so the last one is never cut by its edge. */
        /* October 14: below 1200 the iPad's month card takes the height its
           row gives it and is no longer square. */
        // October 20: approved desktop month is rectangular; all weeks must fit.
        const last = await p.locator('.board-month .cal-day').last().boundingBox()
        assert.ok(last.y + last.height <= square.y + square.height + 0.5, 'the last week sits inside the month card')
      }
      if (route === '/workshop') {
        // October 13: the Workshop is no longer a dead end; the pill is here too.
        assert.equal(await p.locator('.floating-nav').count(), 1)
        const count = await p.evaluate(
          async () => (await (await import('/src/lib/db.ts')).livePages()).length,
        )
        await p.getByRole('button', { name: 'Edit shop routine' }).click()
        await p.waitForURL(/\/p\//)
        assert.equal(
          await p.evaluate(
            async () => (await (await import('/src/lib/db.ts')).livePages()).length,
          ),
          count + 1,
        )
        await p.goto(BASE + '/workshop')
        await p.getByRole('button', { name: 'Edit shop routine' }).click()
        await p.waitForURL(/\/p\//)
        assert.equal(
          await p.evaluate(
            async () => (await (await import('/src/lib/db.ts')).livePages()).length,
          ),
          count + 1,
        )
        await p.goto(BASE + '/workshop')
        await p.getByRole('button', { name: 'Active', exact: true }).click()
        assert.equal(
          await p.locator('.workshop-reference-plan:not([data-status=active])').count(),
          0,
        )
        // October 13: the heading's menu is the Workshop's own, without the other rooms.
        await p.getByRole('button', { name: 'Workshop menu' }).click()
        await p.locator('.workshop-menu').getByRole('button', { name: 'New plan', exact: true }).click()
        await p.getByRole('dialog').waitFor()
      }
    }
    assert.deepEqual(errors, [])
    console.log('passed', width)
    await c.close()
  }
} finally {
  await b.close()
}
