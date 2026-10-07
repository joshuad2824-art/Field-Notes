import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321'
const browser = await chromium.launch()
try {
 for (const width of [1485, 1024, 768, 390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1024 })
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE).origin ? route.continue() : route.abort())
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(BASE); await page.getByRole('heading', { name: 'At the desk.', exact: true }).waitFor()
  await page.evaluate(async () => {
   const { db, changed } = await import('/src/lib/db.ts'); const now = Date.now()
   const row = (id, body) => ({ id, body, created: now, updated: now, pinned: 0, notebook: 'field-notes' })
   await db.pages.bulkPut([
    row('navigation-project', '# Real-source fixture\n#project\nStatus: active\nOwner: Fixture owner\nNext step: Read the actual source.\n\n- [ ] A real saved step\n\n```md\n- [ ] Example must stay hidden\n```'),
    row('navigation-plan', '# Linked fixture plan\n#project-plan\nProject: Real-source fixture\nVersion: 2\n\nReference text retained.'),
    row('navigation-owned', '# Confirmed-owned fixture\n#owned\nBrand: Unknown\nModel: Known fixture model'),
   ])
   await db.sienaItems.put({ id: 'navigation-note', type: 'note', title: 'Saved source note fixture', body: 'The actual saved note body.\n\nIts second paragraph is retained.', created: now, updated: now })
   changed()
  })
  const snapshot = () => page.evaluate(async () => (await (await import('/src/lib/db.ts')).db.pages.toArray()).map(p => ({ id: p.id, body: p.body, created: p.created, updated: p.updated, pinned: p.pinned, notebook: p.notebook })))
  const original = await snapshot()
  const activate = locator => width < 1024 ? locator.tap() : locator.click()
  const fit = async () => {
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
   for (const selector of ['.approved-application', '.approved-content', '.fn-shell', '.fn-project-grid', '.fn-plan-grid', '.fn-book-spines', '.calendar-grid', '.plan-paper', '.leaf', '.listcol']) {
    const nodes = page.locator(selector)
    for (let i = 0; i < await nodes.count(); i++) if (await nodes.nth(i).isVisible()) assert.equal(await nodes.nth(i).evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${width} overflow in ${selector}`)
   }
  }
  const navigation = page.locator(width >= 1024 ? '.fn-rail-group' : '.fn-mobile-navigation')
  await page.locator('.fn-step-list').getByRole('button', { name: 'A real saved step', exact: true }).waitFor()
  assert.equal(await page.locator('.fn-step-list button').count(), 1, 'Fenced examples do not become live project steps')
  assert.equal(await page.locator('.overview-from-siena .siena-item-body').textContent(), 'The actual saved note body.\n\nIts second paragraph is retained.')
  assert.equal(await page.locator('.fn-app .fn-tape-label').count(), 1)
  assert.equal(await page.locator('.desk-workshop').count(), 0)
  assert.equal(await page.locator('.fn-branch, footer').count(), 0)
  assert.equal(await page.locator('.fn-app .overview-forecast').count(), 1)
  await fit()
  const headerDate = page.locator('.fn-date-link')
  const dateStyle = await headerDate.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, border: s.borderTopWidth, shadow: s.boxShadow, family: s.fontFamily } })
  assert.equal(dateStyle.background, 'rgba(0, 0, 0, 0)'); assert.equal(dateStyle.border, '0px'); assert.equal(dateStyle.shadow, 'none'); assert.match(dateStyle.family, /Grape Nuts/)
  await headerDate.focus(); await page.keyboard.press('Enter'); await page.getByRole('heading', { name: 'Your month.' }).waitFor()
  const calendarPath = new URL(page.url()).pathname; assert.match(calendarPath, /^\/calendar\/\d{4}-\d{2}$/)
  await page.locator('.fn-skip').focus(); await page.keyboard.press('Enter'); assert.equal(new URL(page.url()).pathname, calendarPath); assert.equal(await page.locator('#desk-heading').evaluate(el => el === document.activeElement), true)
  assert.equal(await page.locator('.fn-calendar-large .cal-day').count(), 42)
  const currentMonth = await page.locator('.fn-calendar-large .fn-reference-date h2').textContent()
  await activate(page.locator('.fn-calendar-large').getByRole('button', { name: 'The month after', exact: true }))
  const monthPath = new URL(page.url()).pathname; assert.notEqual(monthPath, calendarPath)
  const nextMonth = await page.locator('.fn-calendar-large .fn-reference-date h2').textContent(); assert.notEqual(nextMonth, currentMonth)
  if (width >= 1024) assert.equal(await page.locator('.fn-rail .fn-reference-date h2').textContent(), nextMonth)
  await page.reload(); await page.getByRole('heading', { name: 'Your month.' }).waitFor(); assert.equal(await page.locator('.fn-calendar-large .fn-reference-date h2').textContent(), nextMonth)
  await fit()
  await activate(page.locator('.fn-calendar-large .cal-day:not(.outside)').first()); await page.waitForURL(/\/day\//)
  if (width >= 1024) assert.equal(await page.locator('.fn-rail .cal-day.on').count(), 1)
  await fit(); await page.goBack(); await page.getByRole('heading', { name: 'Your month.' }).waitFor(); await page.goForward(); await page.waitForURL(/\/day\//)
  await activate(navigation.getByRole('link', { name: 'Workshop', exact: true })); await page.getByRole('heading', { name: 'Workshop' }).waitFor()
  await page.locator('.desk-plan-link').waitFor(); assert.equal(await page.locator('.desk-plan-link').count(), 1); await fit()
  await activate(navigation.getByRole('link', { name: 'Workshop', exact: true })); await page.getByRole('heading', { name: 'Workshop' }).waitFor()
  await page.locator('.workshop-item').waitFor(); assert.match(await page.locator('.workshop-item').textContent(), /Known fixture model/); assert.doesNotMatch(await page.locator('.workshop-item').textContent(), /Unknown/); await fit()
  assert.deepEqual(await snapshot(), original, 'Navigation and read-only presentation never write records')
  await activate(page.getByRole('button', { name: 'Ask Siena', exact: true })); await page.getByRole('dialog', { name: 'Ask Siena' }).waitFor(); await page.goBack()
  await page.waitForURL(/\/day\//); await page.getByRole('dialog').waitFor({ state: 'detached' })
  await activate(navigation.getByRole('link', { name: 'Today', exact: true })); await page.getByRole('heading', { name: 'At the desk.' }).waitFor()
  for (let attempt = 0; attempt < 3; attempt++) {
   const opener = page.getByRole('button', { name: 'Ask Siena', exact: true })
   await activate(opener); const dialog = page.getByRole('dialog', { name: 'Ask Siena' }); await dialog.waitFor()
   await dialog.getByLabel('What would you like to work on?').fill('Repeated request fixture')
   await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('fixture denied') } } }))
   await activate(dialog.getByRole('button', { name: 'Copy request', exact: true })); await dialog.getByText(/Copy failed/).waitFor()
   assert.equal(await dialog.getByLabel('What would you like to work on?').inputValue(), 'Repeated request fixture')
   await activate(dialog.getByRole('button', { name: 'Close request' })); await dialog.waitFor({ state: 'detached' }); assert.equal(await opener.evaluate(el => el === document.activeElement), true)
  }
  assert.deepEqual(await snapshot(), original)
  // Model an arriving source update before the UI observes its change signal.
  const remoteBody = await page.evaluate(async () => { const { db } = await import('/src/lib/db.ts'); const p = await db.pages.get('navigation-project'); const body = p.body + '\nA newer source sentence.'; await db.pages.put({ ...p, body, updated: p.updated + 1 }); return body })
  await activate(page.locator('.fn-step-list').getByRole('button', { name: 'A real saved step' })); await page.getByText('This project changed. Review its current steps before trying again.').waitFor()
  assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.ts')).db.pages.get('navigation-project')).body), remoteBody)
  await page.evaluate(async () => (await import('/src/lib/db.ts')).changed()); await page.locator('.fn-step-list').getByRole('button', { name: 'A real saved step' }).waitFor()
  await activate(page.locator('.fn-step-list').getByRole('button', { name: 'A real saved step' })); await page.waitForFunction(async () => (await (await import('/src/lib/db.ts')).db.pages.get('navigation-project')).body.includes('- [x] A real saved step'))
  assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.ts')).db.pages.get('navigation-project')).body), remoteBody.replace('- [ ] A real saved step', '- [x] A real saved step'))
  await page.locator('#desk-heading').focus(); await page.keyboard.press('PageDown'); await page.waitForFunction(() => document.querySelector('.fn-shell').scrollTop > 0)
  await fit(); assert.deepEqual(errors, [])
  console.log(`PASS ${width}px: approved navigation, real-source mapping, calendar synchronization/direct reload/Back/Forward, keyboard date/skip/scroll, repeated/interrupted requests, guarded project step save, no horizontal overflow`)
  await context.close()
 }
} finally { await browser.close() }
