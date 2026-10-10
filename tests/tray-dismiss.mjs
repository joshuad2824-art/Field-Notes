/* Use only fresh Playwright contexts and test pages on a local preview.
   BASE=http://127.0.0.1:4317 node tests/tray-dismiss.mjs */
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'

const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const base = process.env.BASE ?? 'http://127.0.0.1:4173'
const browser = await chromium.launch()

async function run(name, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const activate = locator => options.hasTouch ? locator.tap() : locator.click()
  const toggle = page.getByRole('button', { name: 'Style', exact: true })
  const tray = page.getByRole('toolbar', { name: 'Style', exact: true })
  const assertOpen = async () => {
    assert.equal(await tray.count(), 1)
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  }
  const assertClosed = async () => {
    await tray.waitFor({ state: 'detached' })
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
  }
  const body = () => page.evaluate(async () => {
    const request = indexedDB.open('field-notes')
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('pages', 'readonly')
    const get = tx.objectStore('pages').get(location.pathname.split('/').pop())
    const row = await new Promise(resolve => { get.onsuccess = () => resolve(get.result) })
    db.close()
    return row.body
  })
  const saved = async expected => {
    for (let i = 0; i < 30; i++) {
      if (await body() === expected) return
      await page.waitForTimeout(50)
    }
    assert.equal(await body(), expected)
  }
  try {
    await page.goto(`${base}/n/field-notes`)
    await activate(page.getByRole('button', { name: 'New page', exact: true }).first())
    const content = page.locator('.cm-content')
    await content.fill('Alpha beta\nSecond line\nThird line')
    await content.press('ControlOrMeta+Home')
    await content.press('Shift+End')
    const selected = await page.evaluate(() => window.getSelection().toString())
    assert.equal(selected, 'Alpha beta')
    await activate(toggle)
    await assertOpen()
    for (const group of ['Insert', 'Appearance', 'Text']) {
      await activate(page.getByRole('button', { name: `${group} tools`, exact: true }))
      await assertOpen()
      assert.equal(await page.evaluate(() => window.getSelection().toString()), selected)
    }
    await activate(page.getByRole('button', { name: 'Bold — ⌘B', exact: true }))
    await assertOpen()
    await saved('**Alpha beta**\nSecond line\nThird line')

    // Nested link inputs and buttons stay usable inside the dismissal boundary.
    await activate(page.getByRole('button', { name: 'Link', exact: true }))
    const dialog = page.getByRole('form', { name: 'Add link' })
    await activate(dialog.getByLabel('URL'))
    await dialog.getByLabel('URL').fill('https://example.com/test')
    await assertOpen()
    await activate(dialog.getByRole('button', { name: 'Cancel', exact: true }))
    await assertOpen()

    // Browsers may clear the DOM selection on blur. The editor must retain
    // its range, proven by applying a mark to exactly the selected words.
    const before = await page.evaluate(() => window.getSelection().toString())
    assert.equal(before, selected)
    await activate(page.locator('.saved'))
    await assertClosed()
    await saved('**Alpha beta**\nSecond line\nThird line')
    await activate(toggle)
    await activate(page.getByRole('button', { name: 'Underline — ⌘U', exact: true }))
    await saved('**<u>Alpha beta</u>**\nSecond line\nThird line')
    await activate(page.getByRole('button', { name: 'Underline — ⌘U', exact: true }))
    await saved('**Alpha beta**\nSecond line\nThird line')
    await activate(toggle)
    await assertClosed()
    await activate(toggle)
    await assertOpen()
    await activate(toggle)
    await assertClosed()
    await activate(toggle)
    await assertOpen()

    // The dialog's backdrop is outside its controls, even though it is a child.
    await activate(page.getByRole('button', { name: 'Link', exact: true }))
    const backdrop = page.locator('.link-dialog-backdrop')
    if (options.hasTouch) await backdrop.tap({ position: { x: 5, y: 5 } })
    else await backdrop.click({ position: { x: 5, y: 5 } })
    await assertClosed()
    await saved('**Alpha beta**\nSecond line\nThird line')
    await activate(toggle)
    await assertOpen()

    // The click lands before collapsing the strip moves the editor upward.
    const second = page.locator('.cm-line').nth(1)
    const point = await second.evaluate(el => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rect = range.getBoundingClientRect()
      return { x: rect.right - 1, y: rect.top + rect.height / 2 }
    })
    if (options.hasTouch) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
    await assertClosed()
    await page.keyboard.type('!')
    await saved('**Alpha beta**\nSecond line!\nThird line')

    // Dragging while open also retains the range after dismissal.
    if (!options.hasTouch) {
      await activate(toggle)
      const bounds = await second.evaluate(el => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const rect = range.getBoundingClientRect()
        return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 }
      })
      await page.mouse.move(bounds.left + 1, bounds.y)
      await page.mouse.down()
      await page.mouse.move(bounds.right - 1, bounds.y, { steps: 12 })
      await page.mouse.up()
      await assertClosed()
      assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Second line!')
      await activate(toggle)
      await activate(page.getByRole('button', { name: 'Italic — ⌘I', exact: true }))
      await saved('**Alpha beta**\n*Second line!*\nThird line')
      await activate(page.getByRole('button', { name: 'Close', exact: true }))
      await assertClosed()
    }

    // Contenteditable table selection must survive opening and group changes.
    await activate(content)
    await content.press('ControlOrMeta+End')
    await content.press('Enter')
    await activate(toggle)
    await activate(page.getByRole('button', { name: 'Insert tools', exact: true }))
    await activate(page.getByRole('button', { name: 'Table', exact: true }))
    await assertOpen()
    const cell = page.locator('.md-table td').nth(3)
    await activate(cell)
    await assertClosed()
    await page.keyboard.type('Cell word')
    for (let i = 0; i < 'Cell word'.length; i++) await page.keyboard.press('Shift+ArrowLeft')
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Cell word')
    await activate(toggle)
    await activate(page.getByRole('button', { name: 'Text tools', exact: true }))
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Cell word')
    await activate(page.getByRole('button', { name: 'Bold — ⌘B', exact: true }))
    assert.equal(await cell.locator('b, strong').textContent(), 'Cell word')
    await assertOpen()
    assert.deepEqual(errors, [])
    console.log(`PASS ${name}: outside dismissal, toggle/reopen, groups, link dialog, caret placement, selection, formatting, and table cell`)
  } finally {
    await context.close()
  }
}

try {
  await run('Desktop mouse', { viewport: { width: 1440, height: 900 } })
  await run('iPhone touch', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  await run('iPad touch', { viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
} finally {
  await browser.close()
}
