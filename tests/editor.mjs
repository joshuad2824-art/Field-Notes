/* Editor behaviour checks. These exist because the editor is the product, and
   because two of the rules below — the syntax never showing, and every block
   height being a multiple of 28px — are the ones that quietly break.

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
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
const page = await ctx.newPage()

const problems = []
let failures = 0
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))

const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const type = async (text) => {
  await page.keyboard.type(text, { delay: 8 })
  await page.waitForTimeout(120)
}
const lineText = (n) => page.locator('.cm-line').nth(n).evaluate((el) => el.textContent)
const lastLine = () => page.locator('.cm-line').last().evaluate((el) => el.textContent)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
await page.getByText('New page', { exact: true }).click()
await page.waitForTimeout(500)

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

/* checklists */
await type('- [ ] a task')
ok('the checkbox is drawn', (await page.locator('.md-box').count()) === 1)
ok('its syntax is hidden', (await lastLine())?.trim() === 'a task', await lastLine())
await page.locator('.md-box').click()
await page.waitForTimeout(200)
ok('clicking the box checks it', (await page.locator('.md-done').count()) === 1)
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

/* the bar writes markdown */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('press me')
await page.keyboard.down('Shift')
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.locator('.tool', { hasText: 'B' }).first().click()
await page.waitForTimeout(200)
ok('the bar wraps a selection', (await page.locator('.md-strong').count()) === 1)

/* break this and the page stops looking like paper */
const heights = await page
  .locator('.cm-line')
  .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
const offGrid = heights.filter((h) => h % 28 !== 0)
ok('every block height is a multiple of 28', offGrid.length === 0, `off: ${offGrid.join(', ')}`)

/* the highlighter */
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await type('pigment')
await page.keyboard.down('Shift')
for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft')
await page.keyboard.up('Shift')
await page.locator('.tool[title="Highlighter"]').click()
await page.waitForTimeout(150)
await page.locator('.sw[data-c="forest"]').click()
await page.waitForTimeout(250)
ok('the highlighter marks the selection', (await page.locator('.md-hl-forest').count()) === 1)

/* local storage is the primary store, not a cache */
await page.waitForTimeout(400)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
const titles = await page.locator('.row-title').allTextContents()
ok('the page survived a reload', titles.some((t) => t.includes('The morning')), titles.join(' | '))

/* search never touches the network */
await page.goto(BASE + '/search', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.locator('.well').fill('pigment')
await page.waitForTimeout(600)
ok('search finds the new page', (await page.locator('.row-page').count()) >= 1)

/* the page screen is the page — no banner above it */
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
await page.locator('.row-page').first().click()
await page.waitForTimeout(700)
ok('no banner above the leaf', (await page.locator('.chrome').count()) === 0)

const row = await page.locator('.tools .row').boundingBox()
await page.locator('.cm-scroller').evaluate((el) => (el.scrollTop = 400))
await page.waitForTimeout(300)
const rowAfter = await page.locator('.tools .row').boundingBox()
ok(
  'the tools row stays put while the page scrolls',
  Math.abs(row.y - rowAfter.y) < 1,
  `${row.y} → ${rowAfter.y}`,
)

const fit = await page
  .locator('.tools .row')
  .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
ok('the tools row fits its width', fit.scroll <= fit.client, JSON.stringify(fit))

/* a default is a default: change it and pages that never disagreed follow */
await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
const stockButton = page.locator('.btn', { hasText: 'Stock ·' })
if ((await stockButton.textContent()).includes('paper')) await stockButton.click()
const penButton = page.locator('.btn', { hasText: 'Pen ·' })
if ((await penButton.textContent()).includes('ink')) await penButton.click()
await page.waitForTimeout(300)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.getByText('New page', { exact: true }).click()
await page.waitForTimeout(700)
const leaf = await page
  .locator('.leaf')
  .evaluate((el) => ({ stock: el.dataset.stock, pen: el.dataset.pen }))
ok(
  'a new page follows the default',
  leaf.stock === 'night' && leaf.pen === 'felt',
  JSON.stringify(leaf),
)

/* The keyboard. A real soft keyboard can't be summoned here, so this feeds the
   handler the numbers iOS reports when one opens: a shorter visual viewport,
   scrolled down under the layout viewport. It proves our reaction is right; it
   cannot prove iOS reports what we think, which only the phone can settle. */
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
await page.locator('.row-page').first().click()
await page.waitForTimeout(700)

const toolsResting = await page.locator('.tools .row').boundingBox()
ok('the foot is there with no keyboard', (await page.locator('.pagefoot').count()) === 1)

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

const toolsWithKeyboard = await page.locator('.tools .row').boundingBox()
ok(
  'the tools row is still on screen',
  toolsWithKeyboard.y >= 96 && toolsWithKeyboard.y < 156,
  `y=${toolsWithKeyboard.y}`,
)

await openKeyboard(844, 0)
await page.waitForTimeout(300)
ok('the foot comes back', (await page.locator('.pagefoot').count()) === 1)
const toolsReturned = await page.locator('.tools .row').boundingBox()
ok(
  'the tools row returns to rest',
  Math.abs(toolsReturned.y - toolsResting.y) < 1,
  `${toolsResting.y} → ${toolsReturned.y}`,
)

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
