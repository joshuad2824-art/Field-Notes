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

  await view.locator('.list-row').first().click()
  await view.waitForTimeout(700)
  ok('the toolbar is three marks at rest', (await view.locator('.tools .row button').count()) === 3)

  const leaf = await view.locator('.leaf').boundingBox()
  ok('the leaf fills the desk', leaf.width > 700, `${Math.round(leaf.width)}px`)

  await view.locator('.tools .row .mark-button').first().click()
  await view.waitForTimeout(300)
  ok(
    'the columns can be put away',
    (await view.locator('.rail').count()) === 0 && (await view.locator('.listcol').count()) === 0,
  )
  ok('a breadcrumb takes their place', (await view.locator('.breadcrumb').count()) === 1)
  await view.locator('.tools .row .mark-button').first().click()
  await view.waitForTimeout(300)
  ok('and they come back', (await view.locator('.rail').count()) === 1)
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

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
