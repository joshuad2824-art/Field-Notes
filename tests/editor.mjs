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

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
