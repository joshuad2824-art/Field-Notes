import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188',
  out = process.env.REDESIGN_OUT || 'work/2026-10-12-redesign/screens'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Local unpaired fixtures only')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(),
  results = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.route('**/*', (r) =>
  new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
)
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.setDefaultTimeout(10000)
try {
  await page.goto(BASE + '/tests/redesign-check.html')
  await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
  await page.getByText('Fixtures ready').waitFor()
  const snapshot = () =>
    page.evaluate(async () => {
      const { db } = await import('/src/lib/db.ts')
      const sort = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id))
      return {
        pages: sort(await db.pages.toArray()),
        events: sort(await db.events.toArray()),
        items: sort(await db.sienaItems.toArray()),
        notebooks: sort(await db.notebooks.toArray()),
        images: await Promise.all(
          (await db.images.toArray()).map(async (i) => [
            i.id,
            Array.from(new Uint8Array(await i.blob.arrayBuffer())),
          ]),
        ),
      }
    })
  const before = await snapshot()
  const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA')),
    month = today.slice(0, 7)
  const visit = async (path, width = 1440, height = 900) => {
    await page.setViewportSize({ width, height })
    await page.goto(BASE + path)
    await page.waitForTimeout(300)
    await page.evaluate(() => document.fonts.ready)
  }
  const shot = async (name) => {
    const fit = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth <= innerWidth,
      main: [...document.querySelectorAll('main,.approved-content,.month-cell,.board-tile')]
        .filter((e) => e.clientWidth > 0)
        .every((e) => e.scrollWidth <= e.clientWidth + 2),
    }))
    assert.ok(
      fit.document && fit.main,
      `${name}: overflow ${JSON.stringify(fit)} ${await page.evaluate(() => [...document.querySelectorAll('main,.approved-content,.month-cell,.board-tile')].filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2).map((e) => [e.className, e.clientWidth, e.scrollWidth]))}`,
    )
    await page.screenshot({ path: `${out}/${name}.png` })
    results.push(name)
  }
  await visit('/')
  await shot('01-mac-today')
  assert.equal(await page.locator('.today-board .board-tile').count(), 9)
  await visit('/day/' + today)
  await shot('02-mac-agenda')
  await visit('/calendar/' + month)
  await page.getByRole('button', { name: 'Calendar tools', exact: true }).click()
  await page.getByRole('button', { name: 'Colors', exact: true }).click()
  await shot('03-mac-month-color-tray')
  await page.keyboard.press('Escape')
  await visit('/p/redesign-page')
  await shot('04-mac-notebook')
  assert.equal(
    await page
      .locator('.md-h1')
      .first()
      .evaluate((e) => getComputedStyle(e).fontSize),
    '40px',
  )
  assert.equal(
    await page.locator('.cm-content').evaluate((e) => getComputedStyle(e).fontFamily),
    '"Grape Nuts", cursive',
  )
  await visit('/workshop')
  await shot('05-mac-workshop')
  await page.getByRole('button', { name: 'Paused', exact: true }).click()
  assert.equal(await page.locator('.desk-plan-link').count(), 1)
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await visit('/from-siena')
  await shot('06-mac-from-siena')
  await visit('/', 1180, 820)
  await shot('07-ipad-today')
  await visit('/p/redesign-page', 1180, 820)
  await shot('08-ipad-day-and-page')
  assert.ok(await page.locator('.page-day-sheet').isVisible())
  await visit('/', 390, 844)
  await shot('09-iphone-today')
  await visit('/day/' + today, 390, 844)
  await shot('10-iphone-agenda')
  await page.locator('.agenda-date button').first().click()
  assert.ok(await page.locator('.agenda-sheet.is-open').isVisible())
  assert.ok(
    await page
      .locator('.agenda-written')
      .getByText('Fall projects around the house', { exact: true })
      .isVisible(),
  )
  await visit('/p/redesign-page', 390, 844)
  await shot('11-iphone-page')
  await visit('/event/redesign-series')
  await page.locator('main').getByRole('button', { name: 'Edit event', exact: true }).click()
  await shot('12-mac-event')
  await visit('/p/redesign-picture')
  await page.getByRole('button', { name: 'Style', exact: true }).click()
  await shot('13-mac-aa-tray-pictures')
  await visit('/event/redesign-series', 390, 844)
  await shot('14-iphone-event')
  await visit('/p/redesign-picture', 390, 844)
  await shot('15-iphone-page-picture')
  await visit('/')
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  await shot('16-mac-notebook-manager')
  await page.keyboard.press('Escape')
  await visit('/p/redesign-page')
  await page.evaluate(async () => {
    const { setStock } = await import('/src/lib/db.ts')
    await setStock('redesign-page', 'paper')
  })
  await page.waitForTimeout(150)
  await shot('17-mac-paper-stock')
  await page.evaluate(async () => {
    const { db, changed } = await import('/src/lib/db.ts')
    const p = await db.pages.get('redesign-page')
    delete p.stock
    await db.pages.put(p)
    changed()
  })
  const work = before.notebooks.find((n) => n.name === 'St. John').id
  await visit(`/n/${work}/desk`)
  await shot('18-mac-st-john-desk')
  assert.equal(
    await page
      .locator('.work-note h3')
      .first()
      .evaluate((e) => getComputedStyle(e).color),
    'rgb(246, 243, 236)',
  )
  await visit('/search')
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('the')
  await page.waitForTimeout(250)
  await shot('19-mac-search')
  await visit('/settings')
  await shot('20-mac-settings')
  assert.equal(
    await page
      .locator('#settings-sync h2')
      .first()
      .evaluate((e) => getComputedStyle(e).color),
    'rgb(246, 243, 236)',
  )
  await visit('/trash')
  await shot('21-mac-trash')
  assert.equal(
    await page.locator('.trash-app .rows').evaluate((e) => getComputedStyle(e).backgroundImage),
    'none',
  )
  await visit('/calendar/' + month, 390, 844)
  await shot('22-iphone-month')
  await visit('/from-siena', 390, 844)
  await shot('23-iphone-from-siena')
  await visit('/workshop', 390, 844)
  await shot('24-iphone-workshop')
  await visit('/n/garden')
  await shot('25-mac-empty-notebook')
  // Every non-mutating screen must leave the source archive intact; stock changes only its envelope.
  const after = await snapshot()
  after.pages.find((p) => p.id === 'redesign-page').updated = before.pages.find(
    (p) => p.id === 'redesign-page',
  ).updated
  assert.deepEqual(
    after,
    before,
    'Navigation and reading preserve all source records and original images',
  )
  await visit('/p/redesign-page')
  await page.locator('.board-sidebar button[aria-label="Colors"]').click()
  await page.getByRole('button', { name: 'Cranberry', exact: true }).click()
  await page.keyboard.press('Escape')
  await visit('/')
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--th-wash'),
    ),
    '#5A0B25',
  )
  await page.reload()
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--th-wash') === '#5A0B25',
  )
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--th-wash'),
    ),
    '#5A0B25',
  )
  await page.evaluate(async () => {
    const { db, changed } = await import('/src/lib/db.ts')
    await db.events.clear()
    await db.sienaItems.clear()
    changed()
  })
  await visit('/', 390, 844)
  await shot('26-iphone-quiet-day')
  await visit('/search', 390, 844)
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('unfindablezzzz')
  await page.waitForTimeout(200)
  await shot('27a-iphone-nothing-found')
  await page.evaluate(async () => {
    const { db, changed } = await import('/src/lib/db.ts')
    await db.pages.delete('redesign-trash')
    changed()
  })
  await visit('/trash', 390, 844)
  await shot('27b-iphone-empty-trash')
  assert.deepEqual(errors, [], 'No browser runtime errors')
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify(
      { screens: results, errors, preservation: true, themePersistence: true },
      null,
      2,
    ),
  )
  console.log(
    `PASS ${results.length} reference captures; desktop/tablet/phone reflow, source/image preservation, Workshop filtering, phone day access, theme persistence, runtime errors`,
  )
} finally {
  await browser.close()
}
