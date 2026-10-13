// Every route at six widths, on fixtures, with the clock held still so two
// runs minutes apart can be compared pixel for pixel.
// OUT=work/…/before node tests/route-shots.mjs
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Local unpaired fixtures only')
const out = process.env.OUT || 'work/route-shots'
const widths = (process.env.WIDTHS || '1920,1440,1180,820,390,320').split(',').map(Number)
const only = process.env.ROUTES ? process.env.ROUTES.split(',') : null
const ST_JOHN = 'd97288df-10bc-451f-8903-82d4e0c74873'
const NOW = new Date('2026-10-13T10:30:00')
const today = '2026-10-13'
export const routes = [
  ['today', '/'],
  ['notebook', '/n/church'],
  ['notebook-empty', '/n/garden'],
  ['page', '/p/redesign-page'],
  ['journal', '/n/journal'],
  ['st-john', `/n/${ST_JOHN}/desk`],
  ['calendar', '/calendar/2026-10'],
  ['day', `/day/${today}`],
  ['event', '/event/redesign-series'],
  ['event-new', `/event/new/${today}`],
  ['workshop', '/workshop'],
  ['plan', '/plan/redesign-plan'],
  ['from-siena', '/from-siena'],
  ['search', '/search'],
  ['settings', '/settings'],
  ['trash', '/trash'],
  ['tag', '/tag/the-hearth'],
].filter(([name]) => !only || only.includes(name))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const report = []
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: Number(process.env.HEIGHT) || (width >= 1200 ? 900 : width >= 820 ? 1180 : 844) },
      reducedMotion: 'reduce',
    })
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
    )
    const page = await context.newPage()
    await page.clock.setFixedTime(NOW)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE + '/tests/redesign-check.html')
    await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await page.getByText('Fixtures ready').waitFor()
    for (const [name, path] of routes) {
      await page.goto(BASE + path)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(500)
      await page.mouse.move(0, 0)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )
      await page.screenshot({ path: `${out}/${width}-${name}.png` })
      report.push({ width, name, overflow, errors: errors.splice(0) })
    }
    await context.close()
  }
} finally {
  await browser.close()
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
const bad = report.filter((r) => r.errors.length || r.overflow > 0)
console.log(`${report.length} captures in ${out}; ${bad.length} with errors or overflow`)
for (const r of bad) console.log(r.width, r.name, r.overflow, r.errors.join(' | '))
