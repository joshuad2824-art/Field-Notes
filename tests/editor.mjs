/* One thing about the keys, because it cost an afternoon and is invisible
   otherwise: every shortcut here is written `ControlOrMeta+`, never `Control+`.
   CodeMirror binds `Mod-`, which resolves to Cmd on a Mac and Ctrl everywhere
   else, so `Control+End` on a Mac moves nothing at all — the caret stays put,
   the next line of typing lands in the middle of the last one, and what fails
   is some assertion three steps later about text that looks scrambled. The
   suite passed for years on a machine where Ctrl was the modifier and could
   never have passed on the machine this app is actually written on. */
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

/* Every long-standing context in this file declares its zoom already settled,
   so the first-run device default (tested in its own section at the end)
   doesn't move the pitch under two hundred assertions that measure it. */
const settledZoom = () => {
  /* about:blank, which goBack can land on, denies storage — nothing to settle there */
  try {
    localStorage.setItem('field-notes.zoom-defaulted', '1')
    if(!localStorage.getItem('field-notes.settings'))localStorage.setItem('field-notes.settings',JSON.stringify({pen:'ink',stock:'paper',zoom:1}))
  } catch {
    /* not a document with settings */
  }
}

const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
await ctx.addInitScript(settledZoom)
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

await page.goto(BASE + '/n/field-notes', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)

/* The type is self-hosted. If Spectral or Playfair ever come off a CDN
   again — or the local files go missing — first paint on a fresh device with
   no network falls back to Georgia, and the feel of this app is almost
   entirely type. */
await page.evaluate(async () => { await Promise.all([document.fonts.load('17px Spectral'),document.fonts.load('700 20px \"Playfair Display\"')]);await document.fonts.ready })
ok(
  'the type loads from our own origin',
  await page.evaluate(
    () => document.fonts.check('17px Spectral') && document.fonts.check('700 20px "Playfair Display"'),
  ),
)
ok(
  'and nothing asks a font CDN for it',
  await page.evaluate(
    () =>
      !performance
        .getEntriesByType('resource')
        .some((r) => r.name.includes('fonts.googleapis.com') || r.name.includes('fonts.gstatic.com')),
  ),
)

await page.getByRole('button', { name: 'New page', exact: true }).first().click()
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
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await type('**bold**')
ok('bold renders', (await page.locator('.md-strong').count()) === 1)
await page.keyboard.press('Backspace')
await page.waitForTimeout(200)
const afterBackspace = await lastLine()
/* One press takes the marker, which is the point of it being an atomic range
   rather than two characters. It used to take only the one under the caret and
   leave the other with nothing to pair with — so `**` appeared on the page and
   had to be deleted by hand. The pair goes together now: the word stays, no
   longer bold, which is a thing you can watch happen. */
ok('backspace takes the whole marker', afterBackspace === 'bold', JSON.stringify(afterBackspace))
ok('and the one it was paired with', (await page.locator('.md-strong').count()) === 0)

/* the keyboard writes markdown, now that the bar is three marks */
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await type('press me')
await page.keyboard.down('Shift')
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.keyboard.press('ControlOrMeta+b')
await page.waitForTimeout(250)
ok('⌘B wraps a selection', (await page.locator('.md-strong').count()) === 1)

/* break this and the page stops looking like paper */
const heights = await page
  .locator('.cm-line')
  .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
const offGrid = heights.filter((h) => h % 28 !== 0)
ok('every block height is a multiple of 28', offGrid.length === 0, `off: ${offGrid.join(', ')}`)

/* The leaf draws no scrollbar, on either stock. Asserted as the gutter rather
   than as the declaration, because the declaration is the half a platform is
   allowed to ignore: what matters is that no strip of the leaf is spent on a
   bar. The scroller is squeezed so it certainly overflows — a suite that only
   ever checks a page short enough to fit is checking nothing — and put back
   afterwards. The control gutter is reported beside it: where a platform draws
   overlay bars everywhere it will read 0, which is the one case where this
   assertion passes for free and the number is there to say so. */
const gutters = await page.evaluate(() => {
  const el = document.querySelector('.editor .cm-scroller')
  const was = el.style.height
  el.style.height = '80px'
  const leaf = {
    gutter: el.offsetWidth - el.clientWidth,
    overflowing: el.scrollHeight > el.clientHeight,
    declared: getComputedStyle(el).scrollbarWidth,
    /* The other hand, and the one that matters on the devices this actually
       runs on: Safari and older Chromium read only the pseudo-element. An
       unstyled scroller answers `block` here, so this is not a free pass. */
    pseudo: getComputedStyle(el, '::-webkit-scrollbar').display,
  }
  el.style.height = was
  /* A probe rather than another element of the app: at this width the page has
     replaced the list, so there is no column on screen to read a control off,
     and a control that isn't there is exactly the false pass this suite has
     been caught by before. */
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:60px;height:60px;overflow:auto;visibility:hidden'
  probe.innerHTML = '<div style="height:400px"></div>'
  document.body.append(probe)
  const control = probe.offsetWidth - probe.clientWidth
  probe.remove()
  return { leaf, control }
})
ok(
  'the leaf spends no width on a scrollbar',
  gutters.leaf.overflowing && gutters.leaf.gutter === 0,
  `gutter ${gutters.leaf.gutter}px, declared ${gutters.leaf.declared}, control ${gutters.control}px`,
)
ok('and says so in both hands', gutters.leaf.declared === 'none' && gutters.leaf.pseudo === 'none', `scrollbar-width ${gutters.leaf.declared}, ::-webkit-scrollbar ${gutters.leaf.pseudo}`)

/* the highlighter, from the tray */
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await type('pigment')
await page.keyboard.down('Shift')
for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.locator('.mark-button[aria-label="Style"]').click()
await page.waitForTimeout(200)
ok('the tray opens from Aa', (await page.locator('.tray').count()) === 1)
await page.getByRole('button', { name: 'Appearance tools', exact: true }).click()
await page.locator('.tray .sw[aria-label="forest"]').click()
await page.waitForTimeout(250)
ok('the highlighter marks the selection', (await page.locator('.md-hl-forest').count()) === 1)

/* the blocks came back to the tray — they were only ever missing their
   buttons, never their grammar */
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await type('a line to shape')

const wasDots = await page.locator('.md-dot').count()
await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-block[aria-label="Bullet"]').click()
await page.waitForTimeout(200)
ok('the tray writes a bullet', (await page.locator('.md-dot').count()) === wasDots + 1)

await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-block[aria-label="Dash"]').click()
await page.waitForTimeout(200)
ok('and swaps it for a dash', (await page.locator('.md-dash').count()) === 1)

await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-block[aria-label="Numbers"]').click()
await page.waitForTimeout(200)
ok('and numbers it', (await page.locator('.md-num').count()) === 1)

const wasBoxes = await page.locator('.md-box').count()
await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-block[aria-label="Checkbox"]').click()
await page.waitForTimeout(200)
ok('and gives it a box', (await page.locator('.md-box').count()) === wasBoxes + 1)

await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-block[aria-label="Quote"]').click()
await page.waitForTimeout(200)
ok('and turns it into a quote', (await page.locator('.md-quote').count()) === 1)
ok('none of which shows its syntax', (await lastLine()) === 'a line to shape', await lastLine())

/* a mark finds the word under the caret, because nothing is ever selected
   when a finger taps B */
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await type('emphasis')
const wasStrong = await page.locator('.md-strong').count()
await page.getByRole('button', { name: 'Text tools', exact: true }).click()
await page.locator('.tray-mark[aria-label^="Bold"]').click()
await page.waitForTimeout(250)
ok(
  'a mark takes the word under the caret',
  (await page.locator('.md-strong').count()) === wasStrong + 1,
)
ok('and hides its asterisks', (await lastLine()) === 'emphasis', await lastLine())

/* an empty pair has nothing to wrap, so the grammar can't hide it — better to
   do nothing than to show four asterisks */
await page.keyboard.press('ControlOrMeta+End')
await page.keyboard.press('Enter')
await page.keyboard.press('ControlOrMeta+b')
await page.waitForTimeout(200)
ok(
  'a mark with no word leaves no syntax behind',
  !(await lastLine())?.includes('*'),
  JSON.stringify(await lastLine()),
)

/* indent is leading spaces, hidden like every other marker and said again as
   space on the page */
await page.keyboard.press('ControlOrMeta+End')
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
await page.keyboard.press('ControlOrMeta+End')
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
await page.getByRole('button', { name: 'New page', exact: true }).click()
await page.waitForTimeout(700)
ok('a page starts from inside a page', page.url() !== wasPage, page.url())
ok(
  'and it opens empty',
  (await page.locator('.cm-content').evaluate((el) => el.textContent))?.trim() === '',
)

/* local storage is the primary store, not a cache */
await page.waitForTimeout(400)
await page.goto(BASE + '/n/field-notes', { waitUntil: 'domcontentloaded' })
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
await page.getByRole('searchbox',{name:'Search',exact:true}).fill('pigment')
await page.waitForTimeout(600)
ok('search finds the new page', (await page.locator('.search-hit').count()) >= 1)

/* ── the keyboard ───────────────────────────────────────────────────── */

await page.goto(BASE + '/n/field-notes', { waitUntil: 'domcontentloaded' })
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

/* Responsive shell, notebook management and safe areas are exercised in
   redesign.mjs and redesign-actions.mjs against the October 12 handoff. */
const lastLineIn = (view) => view.locator('.cm-line').last().evaluate(el => el.textContent)
async function atWidth(width,height,run) {
 const context=await browser.newContext({viewport:{width,height}})
 await context.addInitScript(settledZoom)
 const view=await context.newPage();view.on('pageerror',e=>problems.push(`${width}px: ${e.message}`))
 await view.goto(BASE+'/n/field-notes');await view.waitForTimeout(700)
 await run(view,context);await context.close()
}

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
  await view.getByRole('button', { name: 'New page', exact: true }).first().click()
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
  await view.keyboard.press('ControlOrMeta+End')
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
  await view.keyboard.press('ControlOrMeta+End')
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
  await view.keyboard.press('ControlOrMeta+End')
  const platesBefore = await view.locator('.md-plate').count()
  await view.evaluate(async () => {
    /* Made here rather than fetched from `public/`: this checks that a paste
       lands a picture, not that any particular asset is still shipping, and
       the placeholder icon it used to fetch has since been deleted. */
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="46" fill="#b98a3c"/></svg>'
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const data = new DataTransfer()
    data.items.add(new File([blob], 'pasted.svg', { type: 'image/svg+xml' }))
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
  await view.keyboard.press('ControlOrMeta+End')
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
      const id = location.pathname.split('/').pop()
      const row = await new Promise((r) => {
        const q = db.transaction('pages').objectStore('pages').get(id)
        q.onsuccess = () => r(q.result)
      })
      return row?.body ?? ''
    })

  await view.getByRole('button', { name: 'New page', exact: true }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()
  await view.keyboard.type('# Stock', { delay: 6 })
  await view.keyboard.press('Enter')

  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.getByRole('button', { name: 'Insert tools', exact: true }).click()
  await view.getByRole('button', { name: 'Table', exact: true }).click()
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
  /* Two lines on a Mac, sometimes three on Linux — how many is the
     rasterizer's business. What must hold: the cell wrapped at all, and the
     row grew by whole lines. */
  ok(
    'a cell wraps and takes its row with it',
    heights[1] >= 56 && heights[1] % 28 === 0,
    JSON.stringify(heights),
  )
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
  await view.locator('.md-table-control[aria-label^="Add a row"]').click()
  await view.waitForTimeout(400)
  ok('a row can be added', (await view.locator('.md-table tr').count()) === 4)

  await view.locator('.md-table td').nth(3).click()
  await view.locator('.md-table-control[aria-label^="Add a column"]').click()
  await view.waitForTimeout(400)
  ok('a column can be added', (await view.locator('.md-table tr').first().locator('td').count()) === 4)

  await view.locator('.md-table td').nth(4).click()
  await view.locator('.md-table-control[aria-label="Remove these columns"]').click()
  await view.waitForTimeout(400)
  ok(
    'and taken away again',
    (await view.locator('.md-table tr').first().locator('td').count()) === 3,
  )

  /* merging is per row — that is the whole point of it */
  await view.locator('.md-table td').nth(4).click()
  await view.locator('.md-table-control[aria-label="Merge the picked cells, or join this one to its right"]').click()
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

  await view.locator('.md-table-control[aria-label="Give the merged cells back"]').click()
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
  const reloaded = await stored()
  ok('the table survived a reload', reloaded === wanted,
    reloaded === wanted ? '' : JSON.stringify({ before: wanted.slice(0, 160), after: reloaded.slice(0, 160) }))
  ok('and drew itself again', (await view.locator('.md-table').count()) === 1)

  /* a table is structure, not prose */
  const title = await view.locator('.list-row.active .list-row-title').textContent()
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
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-word[title="Pen"]').click()
  await view.waitForTimeout(500)
  ok('the felt pen takes the rules over', await shown('felt'))
  ok('and the ink hand goes', !(await shown('ink')))
  ok(
    'the wander is seeded, so it never shivers as you type',
    (await felt.getAttribute('d')) === wandering,
  )
})

/* ── the underline, and where a line sits ───────────────────────────── */

/* Two marks that had to be invented rather than looked up: markdown has no
   underline and no alignment, and each is said here in the smallest thing
   that another editor can still make sense of. */
await atWidth(1440, 900, async (view) => {
  const stored = () =>
    view.evaluate(async () => {
      const request = indexedDB.open('field-notes')
      const db = await new Promise((r) => {
        request.onsuccess = () => r(request.result)
      })
      const id = location.pathname.split('/').pop()
      const row = await new Promise((r) => {
        const q = db.transaction('pages').objectStore('pages').get(id)
        q.onsuccess = () => r(q.result)
      })
      return row?.body ?? ''
    })

  /* A detail is printed on the same line as the result, so a whole body —
     which is several lines — is quoted by the one line being asked about. */
  const bodyLine = async (match) =>
    (await stored()).split('\n').find((l) => l.includes(match)) ?? '(not found)'

  const pitchHolds = async () => {
    const heights = await view
      .locator('.cm-line')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
    return heights.every((h) => h % 28 === 0)
  }

  await view.getByRole('button', { name: 'New page', exact: true }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()
  await view.keyboard.type('# A dedication', { delay: 6 })
  await view.keyboard.press('Enter')
  await view.keyboard.type('for Ruth', { delay: 6 })
  await view.waitForTimeout(250)

  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)

  /* the underline */
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Underline — ⌘U"]').click()
  await view.waitForTimeout(350)

  ok('the underline marks the word under the caret', (await view.locator('.md-underline').count()) === 1)
  ok(
    'and the tags never show',
    (await view.locator('.cm-line').last().evaluate((el) => el.textContent)) === 'for Ruth',
    await view.locator('.cm-line').last().evaluate((el) => el.textContent),
  )
  ok('the file gets the tag itself', (await stored()).includes('for <u>Ruth</u>'), await bodyLine('Ruth'))
  ok('and the line box is still 28', await pitchHolds())

  const strokeNow = () =>
    view.locator('.md-underline').evaluate((el) => getComputedStyle(el).backgroundImage)
  ok(
    'the ink hand is a fine rule, not a decoration',
    (await strokeNow()).startsWith('linear-gradient') &&
      (await view
        .locator('.md-underline')
        .evaluate((el) => getComputedStyle(el).textDecorationLine)) === 'none',
    await strokeNow(),
  )

  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-word[title="Pen"]').click()
  await view.waitForTimeout(350)
  ok('the felt pen underlines with a drawn stroke', (await strokeNow()).includes('svg+xml'))
  ok('which is still a background, so it costs no height', await pitchHolds())
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-word[title="Pen"]').click()
  await view.waitForTimeout(300)

  /* it nests both ways, because the tray can produce either — U then B puts
     the tags outside, B then U puts them inside */
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Bold — ⌘B"]').click()
  await view.waitForTimeout(350)
  ok('the tags outside a bold word still hide', (await lastLineIn(view)) === 'for Ruth', await lastLineIn(view))
  ok(
    'and both marks draw',
    (await view.locator('.md-underline').count()) === 1 &&
      (await view.locator('.md-strong').count()) === 1,
    await bodyLine('Ruth'),
  )

  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Bold — ⌘B"]').click()
  await view.waitForTimeout(300)
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Underline — ⌘U"]').click()
  await view.waitForTimeout(300)
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Bold — ⌘B"]').click()
  await view.waitForTimeout(300)
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Underline — ⌘U"]').click()
  await view.waitForTimeout(350)
  ok('the tags inside a bold word hide too', (await lastLineIn(view)) === 'for Ruth', await lastLineIn(view))
  ok('which is the other order the tray produces', (await bodyLine('Ruth')).includes('**<u>Ruth</u>**'), await bodyLine('Ruth'))

  /* tapping it again takes it off, which is the only way back */
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Underline — ⌘U"]').click()
  await view.waitForTimeout(300)
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="Bold — ⌘B"]').click()
  await view.waitForTimeout(350)
  ok('a second tap takes each off', !(await stored()).includes('<u>') && !(await stored()).includes('**'), await bodyLine('Ruth'))

  /* where the line sits */
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-block[aria-label="Centre the line"]').click()
  await view.waitForTimeout(350)
  ok('a line can be centred', (await view.locator('.md-align-center').count()) === 1)
  ok(
    'and it is really centred, not just marked',
    (await view
      .locator('.md-align-center')
      .evaluate((el) => getComputedStyle(el).textAlign)) === 'center',
  )
  ok('the tag is hidden like every other marker', (await lastLineIn(view)) === 'for Ruth')
  ok('the file says so in a brace tag', (await stored()).includes('{center}for Ruth'), await bodyLine('Ruth'))
  ok('and nothing moved off the 28px grid', await pitchHolds())

  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-block[aria-label="Line to the right"]').click()
  await view.waitForTimeout(350)
  ok(
    'the same line can go to the far right instead',
    (await view.locator('.md-align-right').count()) === 1 &&
      (await view.locator('.md-align-center').count()) === 0,
  )
  ok('and it swaps rather than stacking', !(await stored()).includes('{center}'), await bodyLine('Ruth'))

  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-block[aria-label="Line to the right"]').click()
  await view.waitForTimeout(350)
  ok('tapping it again puts the line back to the margin', !(await stored()).includes('{right}'))
  ok('and nothing is left behind', (await lastLineIn(view)) === 'for Ruth')

  /* alignment sits in front of the block prefix, so a heading is both */
  await view.locator('.cm-content').click()
  await view.keyboard.press('ControlOrMeta+Home')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-block[aria-label="Centre the line"]').click()
  await view.waitForTimeout(400)
  ok(
    'a heading can be centred and stay a heading',
    (await view.locator('.md-h1.md-align-center').count()) === 1,
  )
  ok('the hashes are still hidden', (await view.locator('.cm-line').first().evaluate((el) => el.textContent)) === 'A dedication')
  ok('the file keeps them in order', (await stored()).startsWith('{center}# A dedication'), (await stored()).split('\n')[0])

  /* a tag is not what the page is called */
  const title = await view.locator('.list-row-title').first().textContent()
  ok('a centred title is still the title', title === 'A dedication', title)
})

/* ── how wide the whole table sits ──────────────────────────────────── */

await atWidth(1440, 900, async (view) => {
  const stored = () =>
    view.evaluate(async () => {
      const request = indexedDB.open('field-notes')
      const db = await new Promise((r) => {
        request.onsuccess = () => r(request.result)
      })
      const id = location.pathname.split('/').pop()
      const row = await new Promise((r) => {
        const q = db.transaction('pages').objectStore('pages').get(id)
        q.onsuccess = () => r(q.result)
      })
      return row?.body ?? ''
    })

  await view.getByRole('button', { name: 'New page', exact: true }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()
  await view.keyboard.type('# Cut list', { delay: 6 })
  await view.keyboard.press('Enter')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.getByRole('button', { name: 'Insert tools', exact: true }).click()
  await view.getByRole('button', { name: 'Table', exact: true }).click()
  await view.waitForTimeout(500)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)

  const frameWidth = () =>
    view.locator('.md-table-frame').evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const full = await frameWidth()
  ok('a new table takes the whole measure', full > 500, `${full}px`)
  ok('and says nothing about its width in the file', !(await stored()).includes('{table'))

  ok('the table has an edge grip of its own', (await view.locator('.md-table-grip.edge').count()) === 1)

  await view.locator('.md-table td').first().click()
  await view.locator('.md-table-grip.edge').waitFor({state:'visible'})
  const box = await view.locator('.md-table-grip.edge').boundingBox()
  await view.mouse.move(box.x + box.width / 2, box.y + 20)
  await view.mouse.down()
  await view.mouse.move(box.x + box.width / 2 - 240, box.y + 20, { steps: 10 })
  await view.mouse.up()
  await view.waitForTimeout(500)

  const pulled = await frameWidth()
  ok('the whole table can be dragged narrower', pulled < full - 180, `${full} → ${pulled}`)

  const lines = (await stored()).split('\n')
  const attr = lines.find((l) => l.startsWith('{table'))
  ok('the width is one line above the table', /^\{table \d{1,3}\}$/.test(attr ?? ''), String(attr))
  ok(
    'and the table under it is untouched GFM',
    /^\|(?:\s*:?-+:?\s*\|)+$/.test((lines.find((l) => /^\|\s*-/.test(l)) ?? '').trim()),
    lines.find((l) => /^\|\s*-/.test(l)),
  )
  ok(
    'the columns keep their shares of it',
    (await view.locator('.md-table td').count()) === 9,
  )

  /* the file is the storage format, so it has to come back */
  const wanted = await stored()
  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(900)
  const reloaded = await stored()
  ok('the width survived a reload', reloaded === wanted,
    reloaded === wanted ? '' : JSON.stringify({ before: wanted.slice(0, 160), after: reloaded.slice(0, 160) }))
  ok('and the table drew itself narrow again', Math.abs((await frameWidth()) - pulled) <= 2, `${await frameWidth()}px`)
  ok(
    'the width line is never read as writing',
    (await view.locator('.list-row.active .list-row-title').textContent()) === 'Cut list',
    await view.locator('.list-row.active .list-row-title').textContent(),
  )

  /* and a way back that isn't a drag to the exact edge */
  await view.locator('.md-table td').first().click()
  await view.waitForTimeout(200)
  await view.locator('.md-table-control[aria-label="Back to the full measure"]').click()
  await view.waitForTimeout(500)
  ok('it can be given the whole measure back', Math.abs((await frameWidth()) - full) <= 2, `${await frameWidth()}px`)
  ok('and the line goes with it', !(await stored()).includes('{table'), (await stored()).split('\n')[1])
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

  await view.getByRole('button', { name: 'New page', exact: true }).click()
  await view.waitForTimeout(600)
  await view.locator('.cm-content').click()

  /* A highlight never spans a line break. The grammar reads one line at a
     time, so an opening on one line and its close on the next can never be
     hidden — which is how four characters of markdown end up on the page. */
  await view.keyboard.type('Additional notes here', { delay: 5 })
  await view.keyboard.press('Enter')
  await view.keyboard.type('and a second line', { delay: 5 })
  await view.keyboard.press('ControlOrMeta+Home')
  await view.keyboard.down('Shift')
  await view.keyboard.press('ControlOrMeta+End')
  await view.keyboard.up('Shift')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.waitForTimeout(250)
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
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
  await view.keyboard.press('ControlOrMeta+End')
  await view.keyboard.press('Enter')
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.getByRole('button', { name: 'Insert tools', exact: true }).click()
  await view.getByRole('button', { name: 'Table', exact: true }).click()
  await view.waitForTimeout(500)

  const cells = view.locator('.md-table td')
  await cells.nth(0).click()
  await view.keyboard.type('Blog posts', { delay: 5 })
  await view.waitForTimeout(250)
  ok(
    'the head row is not forced to all caps',
    (await cells.nth(0).evaluate((el) => getComputedStyle(el).textTransform)) === 'none',
  )

  await view.locator('.md-table-control[aria-label="Merge the picked cells, or join this one to its right"]').click()
  await view.waitForTimeout(300)
  await view.locator('.md-table td').nth(0).click()
  await view.locator('.md-table-control[aria-label="Merge the picked cells, or join this one to its right"]').click()
  await view.waitForTimeout(400)
  ok(
    'a title can be merged clean across the head row',
    (await view.locator('.md-table tr').first().locator('td').count()) === 1,
  )

  /* the grips hang on a row that still breaks at the seam, so merging the
     head row doesn't take the columns' widths away with it. The edge grip —
     the table's own width — is not one of them and is counted out. */
  ok(
    'the columns still have their grips',
    (await view.locator('.md-table-grip:not(.edge)').count()) === 2,
    String(await view.locator('.md-table-grip:not(.edge)').count()),
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
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label^="Bold"]').click()
  await view.waitForTimeout(500)
  /* Either tag: the file says `**` for both, and the mark is wrapped by hand
     now rather than by `execCommand`, which read the head row's own weight as
     bold and turned it off instead. */
  ok(
    'a cell can be given a mark',
    /<(b|strong)>/i.test(await firstBody.evaluate((el) => el.innerHTML)),
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
  await view.keyboard.press('ControlOrMeta+End')
  await view.keyboard.press('Enter')
  await view.keyboard.type('shouted', { delay: 6 })
  await view.waitForTimeout(200)
  const line = () => view.locator('.cm-line').last().evaluate((el) => el.textContent)
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
  await view.locator('.tray-mark[aria-label="All caps"]').click()
  await view.waitForTimeout(300)
  ok('All caps shouts the word under the caret', (await line()) === 'SHOUTED', await line())
  await view.getByRole('button', { name: 'Text tools', exact: true }).click()
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
  await view.locator('.mark-button[aria-label="Style"]').click()
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  ok('the page starts at 100%', (await view.locator('.tray-zoom').textContent()) === '100%')
  ok('one line is 28px', (await pitchOf()) === 28, String(await pitchOf()))

  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-step[aria-label="Larger"]').click()
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
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
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  ok('zoom is remembered', (await view.locator('.tray-zoom').textContent()) === '150%')

  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-step[aria-label="Smaller"]').click()
  await view.getByRole('button', { name: 'Appearance tools', exact: true }).click()
  await view.locator('.tray-step[aria-label="Smaller"]').click()
  await view.waitForTimeout(400)
  ok('and comes back down', (await view.locator('.tray-zoom').textContent()) === '100%')
})

/* ── the capture path: /new and /today ──────────────────────────────── */

/* The two routes that create. A URL is the one entry point everything can
   reach — a bookmark, a dock icon, an iOS Shortcut — and the whole point is
   a live caret with nothing between the tap and the text. */
{
  const cap = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await cap.addInitScript(settledZoom)
  const view = await cap.newPage()
  view.on('pageerror', (e) => problems.push('capture: ' + e.message))

  const readPages = async () => {
    const open = indexedDB.open('field-notes')
    const dbi = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const rows = await new Promise((res, rej) => {
      const r = dbi.transaction('pages').objectStore('pages').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    dbi.close()
    return rows
  }
  const caretLive = () =>
    view.evaluate(() => document.activeElement?.classList.contains('cm-content') ?? false)
  const lastLineText = () =>
    view
      .locator('.cm-line')
      .last()
      .evaluate((el) => el.textContent)
  /* '2:32 PM — ' or '14:32 — ', depending on the device's own locale. */
  const stampShaped = (text) => /^\d{1,2}[:.]\d{2}(\s?[AP]M)?\s—\s?$/.test(text.trim())

  await view.goto(BASE + '/new', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1100)
  ok('/new lands on a page', view.url().includes('/p/'), view.url())
  ok('with a live caret', await caretLive())
  await view.keyboard.type('caught before it faded', { delay: 8 })
  await view.waitForTimeout(400)
  ok(
    'and typing goes straight onto it',
    (await view.locator('.cm-line').first().evaluate((el) => el.textContent)) ===
      'caught before it faded',
  )

  /* back must step over the moment of creation, not into it */
  await view.goBack()
  await view.waitForTimeout(600)
  ok('back does not return to /new', !view.url().includes('/new'), view.url())

  await view.goto(BASE + '/new/the%20workshop', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1100)
  ok('/new/<notebook> takes a name, case blind', view.url().includes('/p/'), view.url())
  const newest = (await view.evaluate(readPages)).sort((a, b) => b.created - a.created)[0]
  ok('and files the page there', newest?.notebook === 'workshop', String(newest?.notebook))

  /* append to today lands on the day's page — here, the freshest of the
     pages this section just made — with a stamp at its foot */
  await view.goto(BASE + '/today', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1100)
  const todayUrl = view.url()
  ok('/today lands on a page', todayUrl.includes('/p/'), todayUrl)
  ok('with a timestamped line at the foot', stampShaped(await lastLineText()), await lastLineText())
  ok('and the caret after the stamp', await caretLive())
  await view.keyboard.type('held the door', { delay: 8 })
  await view.waitForTimeout(400)

  await view.goto(BASE + '/today', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1100)
  ok('a second thought joins the same page', view.url() === todayUrl, view.url())
  ok('as its own stamped line', stampShaped(await lastLineText()), await lastLineText())
  ok(
    'under the one before it',
    await view
      .locator('.cm-line')
      .allTextContents()
      .then((lines) => lines.some((l) => l.includes('held the door'))),
  )

  /* an empty day starts a page rather than finding one */
  await view.evaluate(async () => {
    const open = indexedDB.open('field-notes')
    const dbi = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const tx = dbi.transaction('pages', 'readwrite')
    const store = tx.objectStore('pages')
    const rows = await new Promise((res) => {
      const r = store.getAll()
      r.onsuccess = () => res(r.result)
    })
    for (const row of rows) store.put({ ...row, deleted: Date.now(), updated: Date.now() })
    await new Promise((res) => (tx.oncomplete = res))
    dbi.close()
  })
  await view.goto(BASE + '/today', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1100)
  ok('an empty day starts a page', view.url().includes('/p/') && view.url() !== todayUrl, view.url())
  ok('holding only the stamp', stampShaped(await lastLineText()), await lastLineText())

  await cap.close()
}

/* ── what the dial opens at ─────────────────────────────────────────── */

/* Decision 6's control does two jobs now: it still steps a page up for a
   room, and its first-run default is where the reading size lives. Spectral
   17 is in the recommended legibility band at a phone's distance, at the ISO
   floor on a tablet, and below the minimum on a desk — so a fresh device
   opens at 100, 125 or 150 and the quarters keep the dots under the lines.
   A device that has already chosen keeps its choice. */
{
  const pitchOn = async (context, open) => {
    const view = await context.newPage()
    view.on('pageerror', (e) => problems.push('dial: ' + e.message))
    await view.goto(BASE + '/n/field-notes', { waitUntil: 'domcontentloaded' })
    await view.waitForTimeout(900)
    await open(view)
    await view.waitForTimeout(900)
    const line = await view
      .locator('.cm-content')
      .evaluate((el) => getComputedStyle(el).lineHeight)
    const whole = await view
      .locator('.cm-line')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
    await context.close()
    return { line, whole }
  }
  const tapFirstRow = (view) => view.locator('.list-row').first().click()

  const desk = await pitchOn(
    await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    tapFirstRow,
  )
  ok('a fresh desk opens the new hand at 100%', desk.line === '28px', desk.line)
  ok(
    'and every block is still a whole number of lines',
    desk.whole.every((h) => h % 28 === 0),
    JSON.stringify(desk.whole.filter((h) => h % 28 !== 0)),
  )

  const pad = await pitchOn(
    await browser.newContext({
      viewport: { width: 834, height: 1112 },
      hasTouch: true,
      isMobile: true,
    }),
    tapFirstRow,
  )
  ok('a fresh tablet opens the new hand at 100%', pad.line === '28px', pad.line)

  const phone = await pitchOn(
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    tapFirstRow,
  )
  ok('and a phone stays at 100%', phone.line === '28px', phone.line)

  /* the default is a first-run value, never an override */
  const settled = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await settled.addInitScript(settledZoom)
  const kept = await pitchOn(settled, tapFirstRow)
  ok('a device that has already chosen keeps its choice', kept.line === '28px', kept.line)
}

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
