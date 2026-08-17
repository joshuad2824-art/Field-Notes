/* Behaviour checks. These exist because the editor is the product, and because
   the rules most worth keeping — the syntax never showing, every block height a
   multiple of 28px, the measure never running away — are the ones that quietly
   break.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=http://localhost:5173 npm run check

   Needs Playwright available (npm i -g playwright, or npx playwright). */

const BASE = process.env.BASE ?? 'http://localhost:4173'

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    /* fall through to a global install */
  }
  try {
    const { execSync } = await import('node:child_process')
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return await import(`${root}/playwright/index.mjs`)
  } catch {
    console.error('Playwright not found. Try: npm i -g playwright && playwright install chromium')
    process.exit(2)
  }
}

const { chromium } = await loadPlaywright()

const browser = await chromium.launch()
const problems = []
let failures = 0

const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── the editor ─────────────────────────────────────────────────────── */

const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => problems.push('editor: ' + e.message))

const type = async (text) => {
  await page.keyboard.type(text, { delay: 8 })
  await page.waitForTimeout(120)
}
const lineText = (n) =>
  page
    .locator('.cm-line')
    .nth(n)
    .evaluate((el) => el.textContent)
const lastLine = () =>
  page
    .locator('.cm-line')
    .last()
    .evaluate((el) => el.textContent)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
await page.getByText('New page', { exact: true }).first().click()
await page.waitForTimeout(600)

const content = page.locator('.cm-content')
await content.click()

/* the syntax is never shown */
await type('# The morning')
ok('heading hides its hashes', (await lineText(0)) === 'The morning', await lineText(0))
ok('heading renders as h1', (await page.locator('.md-h1').count()) === 1)

/* lists carry on, and stop when asked */
await page.keyboard.press('Enter')
await type('* first')
await page.keyboard.press('Enter')
await type('second')
ok('Enter carries the list on', (await page.locator('.md-marker').count()) === 2)

await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await page.waitForTimeout(150)
ok('an empty item ends the list', (await page.locator('.md-marker').count()) === 2)

/* checklists — a circle that fills when it's ticked */
await type('- [ ] a task')
ok('the checkbox is drawn', (await page.locator('.md-box').count()) === 1)
ok('its syntax is hidden', (await lastLine())?.trim() === 'a task', await lastLine())
await page.locator('.md-box').click()
await page.waitForTimeout(200)
ok('clicking the box checks it', (await page.locator('.md-done').count()) === 1)
ok('a ticked box fills', (await page.locator('.md-box .bx-on').count()) === 1)
await page.locator('.md-box').click()
await page.waitForTimeout(200)
ok('clicking again clears it', (await page.locator('.md-done').count()) === 0)

/* markers are atomic — the whole reason this is CodeMirror */
await content.click()
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('**bold**')
ok('bold renders', (await page.locator('.md-strong').count()) === 1)
await page.keyboard.press('Backspace')
await page.waitForTimeout(200)
const afterBackspace = await lastLine()
ok('backspace takes the whole marker', afterBackspace === '**bold', JSON.stringify(afterBackspace))

/* the keyboard writes markdown, now that the bar is three marks */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('press me')
await page.keyboard.down('Shift')
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.keyboard.press('Control+b')
await page.waitForTimeout(250)
ok('⌘B wraps a selection', (await page.locator('.md-strong').count()) === 1)

/* break this and the page stops looking like paper */
const heights = await page
  .locator('.cm-line')
  .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
const offGrid = heights.filter((h) => h % 28 !== 0)
ok('every block height is a multiple of 28', offGrid.length === 0, `off: ${offGrid.join(', ')}`)

/* the highlighter, from the tray */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('pigment')
await page.keyboard.down('Shift')
for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.locator('.mark-button[aria-label="Style"]').click()
await page.waitForTimeout(200)
ok('the tray opens from Aa', (await page.locator('.tray').count()) === 1)
await page.locator('.tray .sw[aria-label="forest"]').click()
await page.waitForTimeout(250)
ok('the highlighter marks the selection', (await page.locator('.md-hl-forest').count()) === 1)

/* the blocks came back to the tray — they were only ever missing their
   buttons, never their grammar */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('a line to shape')

const wasDots = await page.locator('.md-dot').count()
await page.locator('.tray-block[aria-label="Bullet"]').click()
await page.waitForTimeout(200)
ok('the tray writes a bullet', (await page.locator('.md-dot').count()) === wasDots + 1)

await page.locator('.tray-block[aria-label="Dash"]').click()
await page.waitForTimeout(200)
ok('and swaps it for a dash', (await page.locator('.md-dash').count()) === 1)

await page.locator('.tray-block[aria-label="Numbers"]').click()
await page.waitForTimeout(200)
ok('and numbers it', (await page.locator('.md-num').count()) === 1)

const wasBoxes = await page.locator('.md-box').count()
await page.locator('.tray-block[aria-label="Checkbox"]').click()
await page.waitForTimeout(200)
ok('and gives it a box', (await page.locator('.md-box').count()) === wasBoxes + 1)

await page.locator('.tray-block[aria-label="Quote"]').click()
await page.waitForTimeout(200)
ok('and turns it into a quote', (await page.locator('.md-quote').count()) === 1)
ok('none of which shows its syntax', (await lastLine()) === 'a line to shape', await lastLine())

/* a mark finds the word under the caret, because nothing is ever selected
   when a finger taps B */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await type('emphasis')
const wasStrong = await page.locator('.md-strong').count()
await page.locator('.tray-mark[aria-label^="Bold"]').click()
await page.waitForTimeout(250)
ok(
  'a mark takes the word under the caret',
  (await page.locator('.md-strong').count()) === wasStrong + 1,
)
ok('and hides its asterisks', (await lastLine()) === 'emphasis', await lastLine())

/* an empty pair has nothing to wrap, so the grammar can't hide it — better to
   do nothing than to show four asterisks */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await page.keyboard.press('Control+b')
await page.waitForTimeout(200)
ok(
  'a mark with no word leaves no syntax behind',
  !(await lastLine())?.includes('*'),
  JSON.stringify(await lastLine()),
)

/* indent is leading spaces, hidden like every other marker and said again as
   space on the page */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await type('* one')
await page.keyboard.press('Enter')
await type('nested')

/* the line box doesn't move — its padding does, so the wrapped lines keep the
   same edge as the first one */
const padOf = () =>
  page
    .locator('.cm-line')
    .last()
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))

const flat = await padOf()
await page.keyboard.press('Tab')
await page.waitForTimeout(250)
const stepped = await padOf()
ok('Tab steps the line in', stepped > flat, `${flat} → ${stepped}`)
ok(
  'and the spaces never show',
  (await lastLine()) === '•nested',
  JSON.stringify(await lastLine()),
)
ok('the bullet moves in with it', (await page.locator('.md-in-1').count()) === 1)

await page.keyboard.press('Shift+Tab')
await page.waitForTimeout(250)
ok('Shift-Tab steps it back out', (await padOf()) === flat, String(await padOf()))

/* four levels and no further — past that the measure has nothing left */
for (let i = 0; i < 7; i++) {
  await page.keyboard.press('Tab')
  await page.waitForTimeout(80)
}
ok('indent stops at four levels', (await page.locator('.md-in-4').count()) === 1)

/* an empty item gives up a level before it gives up the list */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
const deep = await page.locator('.md-in-4').count()
await page.keyboard.press('Enter')
await page.waitForTimeout(250)
ok('Enter on an empty item steps back out', (await page.locator('.md-in-4').count()) < deep + 1)

/* the grid survives it — indent is horizontal and must stay that way */
const indentedHeights = await page
  .locator('.cm-line')
  .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
ok(
  'indented blocks are still multiples of 28',
  indentedHeights.filter((h) => h % 28 !== 0).length === 0,
  `off: ${indentedHeights.filter((h) => h % 28 !== 0).join(', ')}`,
)

/* a page can be started without leaving the one in hand — below 1120 the list
   and its New page button aren't on screen at all */
await page.locator('.mark-button[aria-label="Style"]').click()
await page.waitForTimeout(150)
const wasPage = page.url()
await page.locator('.mark-button[aria-label="Page options"]').click()
await page.waitForTimeout(250)
await page.locator('.sheet-item', { hasText: 'New page' }).click()
await page.waitForTimeout(700)
ok('a page starts from inside a page', page.url() !== wasPage, page.url())
ok(
  'and it opens empty',
  (await page.locator('.cm-content').evaluate((el) => el.textContent))?.trim() === '',
)

/* local storage is the primary store, not a cache */
await page.waitForTimeout(400)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
const titles = await page.locator('.list-row-title').allTextContents()
ok(
  'the page survived a reload',
  titles.some((t) => t.includes('The morning')),
  titles.join(' | '),
)

/* search never touches the network */
await page.goto(BASE + '/search', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.locator('.well').first().fill('pigment')
await page.waitForTimeout(600)
ok('search finds the new page', (await page.locator('.row-page').count()) >= 1)

/* ── the keyboard ───────────────────────────────────────────────────── */

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
await page.locator('.list-row').first().click()
await page.waitForTimeout(700)

const toolsResting = await page.locator('.tools .row').boundingBox()
ok('the foot is there with no keyboard', (await page.locator('.pagefoot').count()) === 1)
ok('no banner above the leaf', (await page.locator('.chrome').count()) === 0)

const openKeyboard = (height, offsetTop) =>
  page.evaluate(
    ([h, t]) => {
      const vv = window.visualViewport
      Object.defineProperty(vv, 'height', { configurable: true, get: () => h })
      Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => t })
      vv.dispatchEvent(new Event('resize'))
    },
    [height, offsetTop],
  )

await openKeyboard(420, 96)
await page.waitForTimeout(300)
const shifted = await page.evaluate(() => {
  const root = document.getElementById('root').getBoundingClientRect()
  return { top: root.top, height: Math.round(root.height) }
})
ok('the app sizes to the visual viewport', shifted.height === 420, String(shifted.height))
ok('the app follows the viewport offset', shifted.top === 96, String(shifted.top))
ok('the foot gets out of the way', (await page.locator('.pagefoot').count()) === 0)

await openKeyboard(844, 0)
await page.waitForTimeout(300)
ok('the foot comes back', (await page.locator('.pagefoot').count()) === 1)
const toolsReturned = await page.locator('.tools .row').boundingBox()
ok(
  'the tools row returns to rest',
  Math.abs(toolsReturned.y - toolsResting.y) < 1,
  `${toolsResting.y} → ${toolsReturned.y}`,
)

await ctx.close()

/* ── the home indicator ─────────────────────────────────────────────── */

/* Installed on iPadOS, visualViewport.height stops short of the home
   indicator while window.innerHeight does not, so an app sized to the visual
   viewport leaves a strip of the frame showing under it. Chromium never
   reports that, so we tell it to: standalone, and 21px short with no
   keyboard. As with the keyboard tests, this proves our reaction — only the
   device proves iPadOS reports it. */
{
  const inset = await browser.newContext({ viewport: { width: 834, height: 1112 } })
  await inset.addInitScript(() => {
    const real = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      q === '(display-mode: standalone)'
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
        : real(q)
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      get: () => window.innerHeight - 21,
    })
  })
  const view = await inset.newPage()
  view.on('pageerror', (e) => problems.push('home indicator: ' + e.message))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(700)

  const covered = await view.evaluate(() => {
    const box = document.getElementById('root').getBoundingClientRect()
    return {
      short: Math.round(window.innerHeight - box.bottom),
      height: Math.round(box.height),
    }
  })
  ok(
    'an installed app runs to the bottom of the window',
    covered.short === 0,
    `${covered.short}px of frame showing under it`,
  )
  ok('and is the full window tall', covered.height === 1112, String(covered.height))

  /* The keyboard still wins — that is what the visual viewport is for. */
  await view.evaluate(() => {
    const vv = window.visualViewport
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 500 })
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 60 })
    vv.dispatchEvent(new Event('resize'))
  })
  await view.waitForTimeout(300)
  const ducked = await view.evaluate(() => {
    const box = document.getElementById('root').getBoundingClientRect()
    return { top: Math.round(box.top), height: Math.round(box.height) }
  })
  ok(
    'and it still ducks the keyboard',
    ducked.height === 500 && ducked.top === 60,
    JSON.stringify(ducked),
  )
  await inset.close()
}

/* ── three widths ───────────────────────────────────────────────────── */

async function atWidth(width, height, run) {
  const context = await browser.newContext({ viewport: { width, height } })
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(`${width}px: ${e.message}`))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(700)
  await run(view, context)
  await context.close()
}

await atWidth(1440, 900, async (view) => {
  ok('the rail docks on desktop', (await view.locator('.rail').count()) === 1)
  ok('the list column docks beside it', (await view.locator('.listcol').count()) === 1)
  ok('there is no chrome bar', (await view.locator('.chrome').count()) === 0)
  ok('there is no cover grid', (await view.locator('.cover').count()) === 0)

  const rail = await view.locator('.rail').boundingBox()
  const list = await view.locator('.listcol').boundingBox()
  ok('the rail is 264 wide', Math.round(rail.width) === 264, String(rail.width))
  ok('the list is 372 wide', Math.round(list.width) === 372, String(list.width))
  ok('the date is the masthead', (await view.locator('.rail-numeral').count()) === 1)
  ok('the rail shows a whole month', (await view.locator('.rail .cal-day').count()) === 42)
  ok('today is the one lit day', (await view.locator('.rail .cal-day.today').count()) === 1)
  /* Folding on an empty desk must not be a one-way door. */
  ok(
    'the bare desk carries the mark too',
    (await view.locator('.desk-marks .mark-button').count()) === 1,
  )

  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)
  /* Five now: the list, undo, redo, Aa and the menu. Still nothing that
     shapes the page — that all lives in the strip behind Aa. */
  ok('the toolbar is five marks at rest', (await view.locator('.tools .row button').count()) === 5)

  const leaf = await view.locator('.leaf').boundingBox()
  ok('the leaf fills the desk', leaf.width > 700, `${Math.round(leaf.width)}px`)

  /* Each column folds on its own. The mark on the desk takes the list; the
     rail folds itself; the mark in the list head brings the rail back. */
  await view.locator('.tools .row .mark-button').first().click()
  await view.waitForTimeout(300)
  ok(
    'the desk mark folds the list alone',
    (await view.locator('.listcol').count()) === 0 && (await view.locator('.rail').count()) === 1,
  )

  await view.locator('.rail-wordmark .mark-button').click()
  await view.waitForTimeout(300)
  ok('the rail folds itself', (await view.locator('.rail').count()) === 0)
  ok('a breadcrumb takes their place', (await view.locator('.breadcrumb').count()) === 1)

  await view.locator('.tools .row .mark-button').first().click()
  await view.waitForTimeout(300)
  ok(
    'the list comes back without the rail',
    (await view.locator('.listcol').count()) === 1 && (await view.locator('.rail').count()) === 0,
  )

  await view.locator('.list-head .mark-button').click()
  await view.waitForTimeout(300)
  ok('and the list head brings the rail back', (await view.locator('.rail').count()) === 1)

  ok(
    'New page sits under the pages, not the notebooks',
    (await view.locator('.list-foot .plate-button').count()) === 1 &&
      (await view.locator('.rail .plate-button').count()) === 0,
  )
})

/* ── the edges of the screen ────────────────────────────────────────── */

/* An iPad reports insets a desktop browser never does, and the bands they
   produce are invisible to us otherwise. Nothing reads env(safe-area-inset-*)
   directly, so setting the two tokens is setting what the device reports. */
await atWidth(1194, 834, async (view) => {
  await view.addStyleTag({ content: ':root { --safe-top: 24px; --safe-bottom: 20px; }' })
  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)

  const band = await view.locator('.statusband').evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    background: getComputedStyle(el).backgroundColor,
  }))
  ok('the status band stands off the inset', Math.round(band.height) === 24, `${band.height}px`)
  ok(
    'and it is the frame teal, not driftwood',
    band.background === 'rgb(20, 42, 43)',
    band.background,
  )

  const leafTop = await view.locator('.leaf').evaluate((el) => el.getBoundingClientRect().top)
  ok('the leaf starts right under it — one band, not two', Math.round(leafTop) === 24, `${leafTop}px`)

  const brown = await view.evaluate(() =>
    [...document.querySelectorAll('*')].filter(
      (el) => getComputedStyle(el).backgroundColor === 'rgb(42, 38, 34)',
    ).length,
  )
  ok('no driftwood band anywhere on a page', brown === 0, `${brown} found`)

  const foot = await view.locator('.pagefoot-measure').evaluate((el) => ({
    pad: getComputedStyle(el).paddingBottom,
    bottom: Math.round(window.innerHeight - el.getBoundingClientRect().bottom),
  }))
  ok('the page foot clears the home indicator', foot.pad === '40px', foot.pad)
  ok('and the leaf runs to the bottom edge', foot.bottom === 0, `${foot.bottom}px short`)
})

await atWidth(1920, 1080, async (view) => {
  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)
  const measure = await view.locator('.cm-content').boundingBox()
  ok(
    'the measure holds on a big monitor',
    measure.width <= 1062,
    `${Math.round(measure.width)}px`,
  )
})

await atWidth(834, 1112, async (view) => {
  ok('an iPad in portrait docks nothing', (await view.locator('.rail').count()) === 0)
  ok('the list takes the window', (await view.locator('.listcol').count()) === 1)
  await view.locator('.list-masthead .mark-button').click()
  await view.waitForTimeout(350)
  ok('the rail slides over', (await view.locator('.rail-drawer').count()) === 1)
  await view.locator('.rail-scrim').click({ position: { x: 700, y: 600 } })
  await view.waitForTimeout(300)
  ok('the scrim closes it', (await view.locator('.rail-drawer').count()) === 0)

  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)
  ok('a page replaces the list', (await view.locator('.listcol').count()) === 0)
  ok('the foot offers the way back', (await view.locator('.foot-back').count()) === 1)
})

await atWidth(390, 844, async (view) => {
  ok('the phone shows the masthead', (await view.locator('.list-masthead').count()) === 1)
  ok('the phone docks no rail', (await view.locator('.rail').count()) === 0)
})

/* ── notebooks are data ─────────────────────────────────────────────── */

await atWidth(1440, 900, async (view) => {
  const before = await view.locator('.book-row').count()
  await view.locator('.link-caps', { hasText: 'Manage' }).click()
  await view.waitForTimeout(400)
  ok('the manager opens', (await view.locator('.manager').count()) === 1)

  await view.locator('.manager .well').fill('The Garden')
  await view.locator('.cover-swatch').nth(4).click()
  await view.locator('.plate-button', { hasText: 'Add notebook' }).click()
  await view.waitForTimeout(700)
  ok('a notebook can be added', (await view.locator('.book-row').count()) === before + 1)

  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(800)
  ok(
    'and it survives a reload',
    (await view.locator('.book-name', { hasText: 'The Garden' }).count()) === 1,
  )

  await view.locator('.link-caps', { hasText: 'Manage' }).click()
  await view.waitForTimeout(400)
  const rows = view.locator('.manager-row')
  const last = rows.nth((await rows.count()) - 1)
  await last.locator('.mark-button').click()
  await view.waitForTimeout(300)
  ok('deleting asks first', (await view.locator('.manager-confirm').count()) === 1)
  await view.locator('.outline.danger').click()
  await view.waitForTimeout(600)
  ok('and then removes it', (await view.locator('.book-row').count()) === before)
})

/* ── pictures ───────────────────────────────────────────────────────── */

/* A valid 60×120 PNG and a bare SVG, written out rather than committed. */
async function fixtures() {
  const { writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { deflateSync, crc32 } = await import('node:zlib')

  const w = 60
  const h = 120
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 200)])),
  )
  /* and one with a transparent border, to prove cut-outs lose their frame */
  const clearRaw = Buffer.concat(
    Array.from({ length: h }, (_, y) => {
      const row = Buffer.alloc(w * 4 + 1)
      for (let x = 0; x < w; x++) {
        const edge = x < 8 || x > w - 9 || y < 8 || y > h - 9
        row.set([200, 120, 40, edge ? 0 : 255], 1 + x * 4)
      }
      return row
    }),
  )
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])

  const clearIhdr = Buffer.from(ihdr)
  clearIhdr[9] = 6
  const clearPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', clearIhdr),
    chunk('IDAT', deflateSync(clearRaw)),
    chunk('IEND', Buffer.alloc(0)),
  ])

  const pngPath = join(tmpdir(), 'field-notes-tall.png')
  const clearPath = join(tmpdir(), 'field-notes-clear.png')
  const svgPath = join(tmpdir(), 'field-notes-mark.svg')
  writeFileSync(pngPath, png)
  writeFileSync(clearPath, clearPng)
  writeFileSync(
    svgPath,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100" height="60">' +
      '<circle cx="50" cy="30" r="24" fill="#c5ae67"/></svg>',
  )
  return { pngPath, clearPath, svgPath }
}

const { pngPath, clearPath, svgPath } = await fixtures()

await atWidth(1440, 950, async (view) => {
  await view.getByText('New page', { exact: true }).first().click()
  await view.waitForTimeout(700)
  await view.locator('.cm-content').click()
  await view.keyboard.type('One')
  await view.keyboard.press('Enter')
  await view.keyboard.type('Two')
  await view.keyboard.press('Enter')
  await view.keyboard.type('Three')
  await view.waitForTimeout(300)

  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray input[type=file]').setInputFiles(pngPath)
  await view.waitForTimeout(1000)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)

  const shape = await view.locator('.md-plate-image').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { drawn: r.height / r.width, natural: el.naturalHeight / el.naturalWidth }
  })
  ok(
    'a picture is shown whole, never cropped',
    Math.abs(shape.drawn - shape.natural) < 0.02,
    `${shape.drawn.toFixed(2)} vs ${shape.natural.toFixed(2)}`,
  )

  /* dragging it moves the node in the document */
  const before = await view.locator('.cm-line').allTextContents()
  const plate = await view.locator('.md-plate-image').boundingBox()
  const firstLine = await view.locator('.cm-line').first().boundingBox()
  await view.locator('.md-plate-image').hover()
  await view.mouse.down()
  await view.mouse.move(firstLine.x + 20, firstLine.y + 4, { steps: 12 })
  await view.mouse.up()
  await view.waitForTimeout(600)
  const moved = await view.locator('.md-plate-image').boundingBox()
  ok(
    'dragging moves it in the page',
    moved.y < plate.y &&
      JSON.stringify(before) !== JSON.stringify(await view.locator('.cm-line').allTextContents()),
    `${Math.round(plate.y)} → ${Math.round(moved.y)}`,
  )

  /* a vector is the graphic and nothing else */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray input[type=file]').setInputFiles(svgPath)
  await view.waitForTimeout(1000)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)

  const vector = await view.locator('.md-plate-cutout .md-plate-image').first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { border: s.borderTopWidth, radius: s.borderTopLeftRadius, shadow: s.boxShadow }
  })
  ok(
    'a vector carries no frame, corner or shadow',
    vector.border === '0px' && vector.radius === '0px' && vector.shadow === 'none',
    JSON.stringify(vector),
  )

  /* a bitmap with real transparency is a cut-out too — the frame is about
     what the picture is, not what the file is called */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray input[type=file]').setInputFiles(clearPath)
  await view.waitForTimeout(1100)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  ok(
    'a transparent png loses its frame too',
    (await view.locator('.md-plate-cutout').count()) >= 2,
    String(await view.locator('.md-plate-cutout').count()),
  )

  /* the plate's own controls */
  const cutout = view.locator('.md-plate').last()
  const openControls = async () => {
    if (!(await cutout.locator('.plate-controls').isVisible())) {
      await cutout.locator('.md-plate-image').click()
      await view.waitForTimeout(250)
    }
  }
  await cutout.locator('.md-plate-image').click()
  await view.waitForTimeout(300)
  ok('a picture shows its controls when tapped', await cutout.locator('.plate-controls').isVisible())

  const wasWide = (await cutout.boundingBox()).width
  await cutout.locator('.plate-control[aria-label="Writing on the right"]').click()
  await view.waitForTimeout(400)
  ok('the writing can run down the right', (await view.locator('.md-plate-left').count()) === 1)
  await openControls()
  await cutout.locator('.plate-control[aria-label="Writing on the left"]').click()
  await view.waitForTimeout(400)
  ok('and down the left', (await view.locator('.md-plate-right').count()) >= 1)

  await openControls()
  await cutout.locator('.plate-control[aria-label="Smaller"]').click()
  await view.waitForTimeout(400)
  const nowNarrow = (await cutout.boundingBox()).width
  ok('a picture can be scaled', nowNarrow < wasWide, `${Math.round(wasWide)} → ${Math.round(nowNarrow)}`)

  const sized = await cutout.evaluate((el) => el.style.getPropertyValue('--plate-width'))
  await view.waitForTimeout(500)
  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1200)
  const afterReload = await view
    .locator('.md-plate')
    .last()
    .evaluate((el) => el.style.getPropertyValue('--plate-width'))
  ok('the size is written into the file', sized === afterReload && sized !== '', `${sized}`)

  /* pasting a picture */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  const platesBefore = await view.locator('.md-plate').count()
  await view.evaluate(async () => {
    const blob = await (await fetch('/icon.svg')).blob()
    const data = new DataTransfer()
    data.items.add(new File([blob], 'icon.svg', { type: 'image/svg+xml' }))
    document
      .querySelector('.cm-content')
      .dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
  })
  await view.waitForTimeout(1200)
  ok('a picture can be pasted in', (await view.locator('.md-plate').count()) === platesBefore + 1)

  /* the mark that shows where it will land, sampled mid-drag */
  const target = await view.locator('.cm-line').first().boundingBox()
  await view.locator('.md-plate-image').last().hover()
  await view.mouse.down()
  await view.mouse.move(target.x + 60, target.y + 200, { steps: 6 })
  await view.waitForTimeout(200)
  await view.mouse.move(target.x + 40, target.y + 6, { steps: 6 })
  await view.waitForTimeout(250)
  ok('a mark shows where it will land', (await view.locator('.cm-drop-marker.on').count()) === 1)
  await view.mouse.up()
  await view.waitForTimeout(400)
  ok('and clears once it lands', (await view.locator('.cm-drop-marker.on').count()) === 0)

  /* the quote stands off its rule */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  await view.keyboard.press('Enter')
  await view.keyboard.type('> a quoted line')
  await view.waitForTimeout(400)
  const pad = await view
    .locator('.md-quote')
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
  ok('the quote text stands off the brass rule', pad >= 28, `${pad}px`)
})

/* ── tables ─────────────────────────────────────────────────────────── */

/* The one block that isn't decorated text. Widths, per-row merges and a cell
   that wraps are all things a row of independent lines cannot do, so the
   whole table is a widget — and everything below is what that widget has to
   get right for the file to stay plain markdown. */
await atWidth(1440, 900, async (view) => {
  const stored = () =>
    view.evaluate(async () => {
      const request = indexedDB.open('field-notes')
      const db = await new Promise((r) => {
        request.onsuccess = () => r(request.result)
      })
      const rows = await new Promise((r) => {
        const q = db.transaction('pages').objectStore('pages').getAll()
        q.onsuccess = () => r(q.result)
      })
      return rows.sort((a, b) => b.updated - a.updated)[0]?.body ?? ''
    })

  await view.locator('.plate-button', { hasText: 'New page' }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()
  await view.keyboard.type('# Stock', { delay: 6 })
  await view.keyboard.press('Enter')

  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray-word', { hasText: 'Table' }).click()
  await view.waitForTimeout(500)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)

  ok('the tray puts a table on the page', (await view.locator('.md-table').count()) === 1)
  ok('it starts three by three', (await view.locator('.md-table td').count()) === 9)

  const cells = view.locator('.md-table td')
  await cells.nth(0).click()
  await view.keyboard.type('Item', { delay: 6 })
  await cells.nth(3).click()
  await view.keyboard.type('White oak, eight quarter, kiln dried and stickered', { delay: 3 })
  await cells.nth(4).click()
  await view.keyboard.type('40', { delay: 6 })
  await view.waitForTimeout(500)

  ok(
    'typing in a cell writes markdown, not a document',
    (await stored()).includes('| White oak, eight quarter, kiln dried and stickered | 40 |'),
    (await stored()).split('\n')[3],
  )

  /* the reason it can't be decorated text */
  const heights = await view
    .locator('.md-table tr')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
  ok('a cell wraps and takes its row with it', heights[1] === 56, JSON.stringify(heights))
  ok(
    'and every row is still a multiple of 28',
    heights.every((h) => h % 28 === 0),
    JSON.stringify(heights),
  )

  /* the rules are drawn over the table, so they cost no height */
  ok('the rules are drawn, not bordered', (await view.locator('.md-table-rules path').count()) > 6)
  ok(
    'the table itself carries no border',
    (await view
      .locator('.md-table table')
      .evaluate((el) => getComputedStyle(el).borderTopWidth)) === '0px',
  )

  /* rows and columns */
  await cells.nth(3).click()
  await view.locator('.md-table-control[aria-label="Add a row"]').click()
  await view.waitForTimeout(400)
  ok('a row can be added', (await view.locator('.md-table tr').count()) === 4)

  await view.locator('.md-table td').nth(3).click()
  await view.locator('.md-table-control[aria-label="Add a column"]').click()
  await view.waitForTimeout(400)
  ok('a column can be added', (await view.locator('.md-table tr').first().locator('td').count()) === 4)

  await view.locator('.md-table td').nth(4).click()
  await view.locator('.md-table-control[aria-label="Remove this column"]').click()
  await view.waitForTimeout(400)
  ok(
    'and taken away again',
    (await view.locator('.md-table tr').first().locator('td').count()) === 3,
  )

  /* merging is per row — that is the whole point of it */
  await view.locator('.md-table td').nth(4).click()
  await view.locator('.md-table-control[aria-label="Join this cell to the one on its right"]').click()
  await view.waitForTimeout(400)
  const spans = await view
    .locator('.md-table tr')
    .nth(1)
    .locator('td')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('colspan'))))
  ok('a cell joins the one beside it', spans.includes(2), JSON.stringify(spans))
  ok('the merge is a mark in the file', (await stored()).includes('<'), 'no marker found')
  ok(
    'and only that row is merged',
    (await view.locator('.md-table tr').first().locator('td').count()) === 3,
  )

  await view.locator('.md-table-control[aria-label="Give the merged column back"]').click()
  await view.waitForTimeout(400)
  ok(
    'and it can be given back',
    (await view.locator('.md-table tr').nth(1).locator('td').count()) === 3,
  )

  /* widths ride in the delimiter row, which is still valid GFM */
  const before = await view
    .locator('.md-table td')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width)
  const grip = view.locator('.md-table-grip').first()
  const box = await grip.boundingBox()
  await view.mouse.move(box.x + box.width / 2, box.y + 20)
  await view.mouse.down()
  await view.mouse.move(box.x + box.width / 2 + 120, box.y + 20, { steps: 8 })
  await view.mouse.up()
  await view.waitForTimeout(500)
  const after = await view
    .locator('.md-table td')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width)
  ok('a column can be dragged wider', after > before + 40, `${Math.round(before)} → ${Math.round(after)}`)

  const delimiter = (await stored()).split('\n').find((l) => /^\|\s*-/.test(l)) ?? ''
  const runs = delimiter.match(/-+/g) ?? []
  ok(
    'the width is dashes in the delimiter row',
    runs.length === 3 && runs[0].length > runs[1].length,
    delimiter,
  )
  ok(
    'which is still a valid GFM delimiter',
    /^\|(?:\s*:?-+:?\s*\|)+$/.test(delimiter.trim()),
    delimiter,
  )

  /* the file is the storage format, so it has to come back */
  const wanted = await stored()
  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(900)
  ok('the table survived a reload', (await stored()) === wanted)
  ok('and drew itself again', (await view.locator('.md-table').count()) === 1)

  /* a table is structure, not prose */
  const title = await view.locator('.list-row-title').first().textContent()
  ok('a table never becomes the page title', !title?.includes('|'), title)

  /* the felt pen draws its rules by hand. Both hands are in the SVG and the
     pen chooses, so the switch needs nothing to redraw */
  const ink = view.locator('.md-table-rules .md-hand-ink').first()
  const felt = view.locator('.md-table-rules .md-hand-felt').first()
  ok('the ink rule is a straight line', !(await ink.getAttribute('d')).includes('Q'))
  ok('the felt rule wanders', (await felt.getAttribute('d')).includes('Q'))
  /* a rule is a line with no height, which Playwright counts as invisible —
     so ask the style, not the box */
  const shown = (mark) =>
    view
      .locator(`.md-table-rules .md-hand-${mark}`)
      .first()
      .evaluate((el) => getComputedStyle(el).display !== 'none')

  ok('and only one hand shows at a time', (await shown('ink')) && !(await shown('felt')))

  const wandering = await felt.getAttribute('d')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray-word[title="Pen"]').click()
  await view.waitForTimeout(500)
  ok('the felt pen takes the rules over', await shown('felt'))
  ok('and the ink hand goes', !(await shown('ink')))
  ok(
    'the wander is seeded, so it never shivers as you type',
    (await felt.getAttribute('d')) === wandering,
  )
})

/* ── what daily use turned up ───────────────────────────────────────── */

/* All four of these were found by writing in the app, not by reading it. */
await atWidth(1440, 900, async (view) => {
  const stored = () =>
    view.evaluate(async () => {
      const request = indexedDB.open('field-notes')
      const db = await new Promise((r) => {
        request.onsuccess = () => r(request.result)
      })
      const rows = await new Promise((r) => {
        const q = db.transaction('pages').objectStore('pages').getAll()
        q.onsuccess = () => r(q.result)
      })
      return rows.sort((a, b) => b.updated - a.updated)[0]?.body ?? ''
    })

  await view.locator('.plate-button', { hasText: 'New page' }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()

  /* A highlight never spans a line break. The grammar reads one line at a
     time, so an opening on one line and its close on the next can never be
     hidden — which is how four characters of markdown end up on the page. */
  await view.keyboard.type('Additional notes here', { delay: 5 })
  await view.keyboard.press('Enter')
  await view.keyboard.type('and a second line', { delay: 5 })
  await view.keyboard.press('Control+Home')
  await view.keyboard.down('Shift')
  await view.keyboard.press('Control+End')
  await view.keyboard.up('Shift')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.locator('.tray .sw[aria-label="brass"]').click()
  await view.waitForTimeout(400)

  ok(
    'a highlight across lines becomes one per line',
    (await view.locator('.md-hl-brass').count()) === 2,
  )
  ok(
    'and never shows its markers',
    !(await view.locator('.cm-content').evaluate((el) => el.textContent)).includes('='),
    await view.locator('.cm-content').evaluate((el) => el.textContent),
  )
  ok(
    'each one closes on the line it opened',
    (await stored()).split('\n').every((l) => !l.trim() || /^=\{?|=={\w+}.*==$/.test(l.trim())),
    JSON.stringify(await stored()),
  )

  /* a table with its head row merged into a title */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  await view.keyboard.press('Enter')
  await view.locator('.tray-word', { hasText: 'Table' }).click()
  await view.waitForTimeout(500)

  const cells = view.locator('.md-table td')
  await cells.nth(0).click()
  await view.keyboard.type('Blog posts', { delay: 5 })
  await view.waitForTimeout(250)
  ok(
    'the head row is not forced to all caps',
    (await cells.nth(0).evaluate((el) => getComputedStyle(el).textTransform)) === 'none',
  )

  await view.locator('.md-table-control[aria-label="Join this cell to the one on its right"]').click()
  await view.waitForTimeout(300)
  await view.locator('.md-table td').nth(0).click()
  await view.locator('.md-table-control[aria-label="Join this cell to the one on its right"]').click()
  await view.waitForTimeout(400)
  ok(
    'a title can be merged clean across the head row',
    (await view.locator('.md-table tr').first().locator('td').count()) === 1,
  )

  /* the grips hang on a row that still breaks at the seam, so merging the
     head row doesn't take the columns' widths away with it */
  ok(
    'the columns still have their grips',
    (await view.locator('.md-table-grip').count()) === 2,
    String(await view.locator('.md-table-grip').count()),
  )

  const firstBody = view.locator('.md-table tr').nth(1).locator('td').first()
  const was = await firstBody.evaluate((el) => el.getBoundingClientRect().width)
  const grip = await view.locator('.md-table-grip').first().boundingBox()
  await view.mouse.move(grip.x + grip.width / 2, grip.y + 10)
  await view.mouse.down()
  await view.mouse.move(grip.x + grip.width / 2 + 130, grip.y + 10, { steps: 8 })
  await view.mouse.up()
  await view.waitForTimeout(500)
  const now = await firstBody.evaluate((el) => el.getBoundingClientRect().width)
  ok(
    'and can still be dragged with the head merged',
    now > was + 40,
    `${Math.round(was)} → ${Math.round(now)}`,
  )

  /* text in a cell takes marks, and the file gets markdown for them */
  await firstBody.click()
  await view.keyboard.type('white oak', { delay: 5 })
  await view.waitForTimeout(200)
  await view.keyboard.down('Shift')
  for (let i = 0; i < 3; i++) await view.keyboard.press('ArrowLeft')
  await view.keyboard.up('Shift')
  await view.locator('.tray-mark[aria-label^="Bold"]').click()
  await view.waitForTimeout(500)
  ok(
    'a cell can be given a mark',
    (await firstBody.evaluate((el) => el.innerHTML)).toLowerCase().includes('<b>'),
    await firstBody.evaluate((el) => el.innerHTML),
  )
  ok(
    'and the file gets markdown for it',
    (await stored()).includes('**oak**'),
    (await stored()).split('\n').find((l) => l.includes('oak')),
  )
})

/* ── the strip, and what it carries ─────────────────────────────────── */

await atWidth(1800, 950, async (view) => {
  await view.locator('.list-row').first().click()
  await view.waitForTimeout(600)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(400)

  /* a strip along the top, not a tall box dropped over the writing */
  const strip = await view.locator('.tray-strip').boundingBox()
  const text = await view.locator('.cm-content').boundingBox()
  ok('the tray opens as a strip', strip.height < 60, `${Math.round(strip.height)}px tall`)
  ok('it runs the width of the leaf', strip.width > 900, `${Math.round(strip.width)}px`)
  ok('and sits above the writing, not over it', strip.y + strip.height <= text.y + 1)
  ok(
    'everything fits without scrolling on a wide desk',
    await view.locator('.tray-strip').evaluate((el) => el.scrollWidth <= el.clientWidth),
  )

  /* all caps is a change to the text — there is no markdown for shouted */
  await view.locator('.cm-content').click()
  await view.keyboard.press('Control+End')
  await view.keyboard.press('Enter')
  await view.keyboard.type('shouted', { delay: 6 })
  await view.waitForTimeout(200)
  const line = () => view.locator('.cm-line').last().evaluate((el) => el.textContent)
  await view.locator('.tray-mark[aria-label="All caps"]').click()
  await view.waitForTimeout(300)
  ok('All caps shouts the word under the caret', (await line()) === 'SHOUTED', await line())
  await view.locator('.tray-mark[aria-label="All caps"]').click()
  await view.waitForTimeout(300)
  ok('and puts it back down again', (await line()) === 'shouted', await line())

  /* undo and redo, back on the toolbar */
  await view.locator('.mark-button[aria-label^="Undo"]').click()
  await view.waitForTimeout(300)
  ok('undo takes it back', (await line()) !== 'shouted')
  await view.locator('.mark-button[aria-label^="Redo"]').click()
  await view.waitForTimeout(300)
  ok('and redo brings it forward', (await line()) === 'shouted', await line())

  /* zoom, for a page on a big screen in front of a room */
  const pitchOf = () =>
    view.locator('.cm-line').last().evaluate((el) => Math.round(el.getBoundingClientRect().height))
  ok('the page starts at 100%', (await view.locator('.tray-zoom').textContent()) === '100%')
  ok('one line is 28px', (await pitchOf()) === 28, String(await pitchOf()))

  await view.locator('.tray-step[aria-label="Larger"]').click()
  await view.locator('.tray-step[aria-label="Larger"]').click()
  await view.waitForTimeout(400)
  ok('zoom steps up', (await view.locator('.tray-zoom').textContent()) === '150%')
  ok('and the pitch stays a whole number of pixels', (await pitchOf()) === 42, String(await pitchOf()))

  /* the rule the whole page is built on has to survive it */
  const zoomed = await view
    .locator('.cm-line')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
  ok(
    'and every block is still a whole number of lines',
    zoomed.every((h) => h % 42 === 0),
    JSON.stringify(zoomed.filter((h) => h % 42 !== 0)),
  )

  /* it is a preference, not a per-page attribute */
  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(900)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(400)
  ok('zoom is remembered', (await view.locator('.tray-zoom').textContent()) === '150%')

  await view.locator('.tray-step[aria-label="Smaller"]').click()
  await view.locator('.tray-step[aria-label="Smaller"]').click()
  await view.waitForTimeout(400)
  ok('and comes back down', (await view.locator('.tray-zoom').textContent()) === '100%')
})

/* ── the calendar ───────────────────────────────────────────────────── */

/* The week strip became a month. The marks say two different things and a day
   can carry both: a ring means something was written that day, and the one
   filled brass dot is today. */
await atWidth(1440, 900, async (view) => {
  ok('a day with pages carries a ring', (await view.locator('.rail .cal-day.written').count()) >= 1)
  ok(
    'and the ring is not the same mark as today',
    await view
      .locator('.rail .cal-day.written .cal-day-n')
      .first()
      .evaluate((el) => getComputedStyle(el).boxShadow.includes('inset')),
  )

  /* the masthead opens the month, whole */
  await view.locator('.rail-datum').click()
  await view.waitForTimeout(600)
  ok('the masthead opens the calendar', view.url().endsWith('/calendar'), view.url())
  ok('which is six weeks of seven', (await view.locator('.calendar-grid .cal-day').count()) === 42)
  ok('with no chrome bar', (await view.locator('.calendar-screen .chrome').count()) === 0)

  const heading = () => view.locator('.calendar-name').textContent()
  const thisMonth = await heading()

  await view.locator('.link-caps[aria-label="The month after"]').click()
  await view.waitForTimeout(400)
  const next = await heading()
  ok('it steps to the month after', next !== thisMonth, `${thisMonth} → ${next}`)
  ok('and says so in the address', /\/calendar\/\d{4}-\d{2}$/.test(view.url()), view.url())

  await view.locator('.link-caps[aria-label="The month before"]').click()
  await view.locator('.link-caps[aria-label="The month before"]').click()
  await view.waitForTimeout(400)
  ok('and to the month before', (await heading()) !== thisMonth && (await heading()) !== next)

  await view.locator('.link-caps', { hasText: 'Today' }).click()
  await view.waitForTimeout(400)
  ok('Today comes back', (await heading()) === thisMonth)
  ok(
    'the month lists its pages beneath it',
    (await view.locator('.calendar-day .row-page').count()) >= 1,
  )

  /* a day opens its own pages */
  await view.locator('.calendar-grid .cal-day.written').first().click()
  await view.waitForTimeout(600)
  ok('a day can be opened', /\/day\/\d{4}-\d{2}-\d{2}$/.test(view.url()), view.url())
  ok('and shows what was written on it', (await view.locator('.row-page').count()) >= 1)

  await view.locator('.row-page').first().click()
  await view.waitForTimeout(600)
  ok('and those pages open', view.url().includes('/p/'), view.url())

  /* an empty day says so rather than showing nothing */
  await view.goto(BASE + '/day/1998-03-04', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(500)
  ok('a day with nothing on it says so', (await view.locator('.empty').count()) === 1)
})

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
