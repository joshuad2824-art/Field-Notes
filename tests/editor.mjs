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
  ok('today is lit in the week strip', (await view.locator('.rail-today').count()) === 1)
  /* Folding on an empty desk must not be a one-way door. */
  ok(
    'the bare desk carries the mark too',
    (await view.locator('.desk-marks .mark-button').count()) === 1,
  )

  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)
  ok('the toolbar is three marks at rest', (await view.locator('.tools .row button').count()) === 3)

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

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
