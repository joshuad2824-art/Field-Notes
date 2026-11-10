/* The November 2026 daily-use pass, end to end.

   On node: the rule for going back to where the app was put down.
   In a browser: Quick Notes, the Reminders room (add, edit, remove, undo, and
   St. John kept apart), the overdue mark, the From Siena tile on Today, ⌘6,
   and a fresh launch returning to the page it was put down on.

     npm run build && npm run preview &
     node tests/daily-use.mjs */

import { placeToResume, RESUME_WINDOW } from '../src/lib/resume.ts'

const BASE = process.env.BASE ?? 'http://localhost:4173'
let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── resuming, on node ───────────────────────────────────────────────────── */
const now = Date.UTC(2026, 10, 10, 12)
const saved = (path, ago) => JSON.stringify({ path, at: now - ago })
ok('a launch soon after being put down goes back', placeToResume(saved('/p/abc', 60_000), '/', now, true) === '/p/abc')
ok('a launch after the window opens on Today', placeToResume(saved('/p/abc', RESUME_WINDOW + 1), '/', now, true) === null)
ok('only in the installed app', placeToResume(saved('/p/abc', 60_000), '/', now, false) === null)
ok('never over a deep link', placeToResume(saved('/p/abc', 60_000), '/calendar', now, true) === null)
ok('never back into a route that creates', placeToResume(saved('/new/field-notes', 60_000), '/', now, true) === null)
ok('never to another site', placeToResume(saved('//evil.example/x', 60_000), '/', now, true) === null)
ok('a damaged record is ignored', placeToResume('{nope', '/', now, true) === null)
ok('a query string comes back too', placeToResume(saved('/archive?notebook=x', 60_000), '/', now, true) === '/archive?notebook=x')

/* ── in a browser ────────────────────────────────────────────────────────── */
async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const { execSync } = await import('node:child_process')
    const root = execSync('npm root -g').toString().trim()
    return await import(`${root}/playwright/index.mjs`)
  }
}
const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
const problems = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.on('pageerror', (e) => problems.push(e.message))

const ST_JOHN = 'd97288df-10bc-451f-8903-82d4e0c74873'
const rows = (store) =>
  page.evaluate(async (name) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('field-notes'); r.onsuccess = () => ok(r.result) })
    return new Promise((ok) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => ok(r.result) })
  }, store)
const put = (store, values) =>
  page.evaluate(async ({ store, values }) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('field-notes'); r.onsuccess = () => ok(r.result) })
    const tx = db.transaction(store, 'readwrite')
    for (const v of values) tx.objectStore(store).put(v)
    await new Promise((ok) => (tx.oncomplete = ok))
  }, { store, values })

await page.goto(BASE + '/')
await page.waitForTimeout(1200)

/* Quick Notes */
const books = await rows('notebooks')
ok('Quick Notes is a notebook on every device', books.some((b) => b.id === 'quick-notes' && b.updated === 0))

/* A leftover unfiled draft from an older build is filed on the next boot. */
await put('meta', [{ key: 'quick-note.draft', value: { id: 'old-draft', body: 'Left from before', notebook: '', created: Date.now() - 5000 } }])
await page.reload()
await page.waitForTimeout(1200)
ok('an unfiled draft left by an older build is filed into Quick Notes',
  (await rows('pages')).some((p) => p.id === 'old-draft' && p.notebook === 'quick-notes'))

await page.locator('.quick-note-open').click()
await page.waitForTimeout(400)
ok('the quick note names where it will go', (await page.locator('.quick-note-books label').first().textContent()).includes('Quick Notes'))
await page.keyboard.type('Ask about the cedar')
await page.getByRole('button', { name: 'Done', exact: true }).click()
await page.waitForTimeout(500)
ok('a quick note with no notebook picked files into Quick Notes',
  (await rows('pages')).some((p) => p.body === 'Ask about the cedar' && p.notebook === 'quick-notes'))
await page.locator('.quick-note-open').click()
await page.waitForTimeout(400)
ok('and the next quick note starts empty', (await page.locator('.quick-note-dialog textarea').inputValue()) === '')
await page.keyboard.type('Bring the folding chairs')
await page.locator('.quick-note-books label', { hasText: 'Church' }).click()
await page.getByRole('button', { name: 'Done', exact: true }).click()
await page.waitForTimeout(500)
ok('a picked notebook still wins', (await rows('pages')).some((p) => p.body === 'Bring the folding chairs' && p.notebook === 'church'))

/* Reminders */
const hour = 3600_000
await put('notebooks', [{ id: ST_JOHN, name: 'St. John', color: '#163F7A', order: 4, updated: 0 }])
await put('sienaItems', [
  { id: 'late', type: 'reminder', title: 'Return the library books', body: 'Return the library books', notebook: 'field-notes', dueAt: Date.now() - 50 * hour, created: 1, updated: 1 },
  { id: 'soon', type: 'reminder', title: 'Call Jim', body: 'Call Jim', notebook: 'hearth', dueAt: Date.now() + 2 * hour, created: 2, updated: 2 },
  { id: 'work', type: 'reminder', title: 'Submit the order set ticket', body: 'Submit the order set ticket', notebook: ST_JOHN, dueAt: Date.now() + hour, created: 3, updated: 3 },
  { id: 'n1', type: 'note', title: 'First note', body: 'The first note in full.', created: Date.now() - 3000, updated: 1 },
  { id: 'n2', type: 'note', title: 'Second note', body: 'Second body.', created: Date.now() - 2000, updated: 1 },
  { id: 'n3', type: 'note', title: 'Third note', body: 'Third body.', created: Date.now() - 1000, updated: 1 },
])
await page.goto(BASE + '/')
await page.waitForTimeout(1200)
ok('an overdue reminder carries the mark, named', (await page.getByRole('img', { name: /^Overdue, 2 days late$/ }).count()) >= 1)
ok('a reminder still to come carries none',
  (await page.locator('#siena-soon .due-late').count()) === 0)
ok("work reminders stay off Today's personal list", (await page.locator('.board-coming #siena-work').count()) === 0)

/* From Siena on Today */
ok('the newest unread note is shown in full', (await page.locator('.board-siena .board-message h3').textContent()).includes('Third note'))
ok('every other unread note is a headline', (await page.locator('.board-headlines li').count()) === 2)
await page.locator('.board-message-seen').click()
await page.waitForTimeout(400)
ok('marking it seen brings the next one up', (await page.locator('.board-siena .board-message h3').textContent()).includes('Second note'))
ok('and the badge counts what is still new', (await page.locator('.board-siena .board-badge').textContent()).trim() === '2 new')
await page.locator('.board-headlines a').first().click()
await page.waitForTimeout(700)
ok('a headline opens From Siena at that note', page.url().endsWith('/from-siena#siena-n1'))

/* The Reminders room */
await page.goto(BASE + '/')
await page.waitForTimeout(600)
await page.keyboard.press('ControlOrMeta+6')
await page.waitForTimeout(600)
ok('⌘6 opens Reminders', new URL(page.url()).pathname === '/reminders')
ok('the work reminder is not listed here', (await page.locator('.reminder-row', { hasText: 'order set ticket' }).count()) === 0)
ok('and the way to it says how many are open', (await page.locator('.reminders-foot').textContent()).includes('St. John · 1 open'))
ok('overdue reminders come first', (await page.locator('.reminder-group h2').first().textContent()) === 'Overdue')

await page.getByRole('button', { name: 'New reminder', exact: true }).click()
await page.keyboard.type('Oil the chisels')
await page.getByRole('button', { name: 'Tomorrow' }).click()
await page.locator('.reminder-add-title').press('Enter')
await page.waitForTimeout(400)
ok('+ then Enter adds a reminder', (await page.locator('.reminder-row', { hasText: 'Oil the chisels' }).count()) === 1)

await page.getByRole('button', { name: 'Edit Oil the chisels' }).click()
await page.getByLabel('Reminder', { exact: true }).fill('Oil and hone the chisels')
await page.getByRole('button', { name: 'Save reminder' }).click()
await page.waitForTimeout(400)
let items = await rows('sienaItems')
const edited = items.find((i) => i.title === 'Oil and hone the chisels')
const replaced = items.find((i) => i.title === 'Oil the chisels')
ok('an edit is a new reminder', !!edited && !edited.completedAt)
ok('and the old one is closed as replaced, not lost',
  !!replaced?.completedAt && !!replaced?.resolvedAt && replaced?.requiresAction === false)

await page.getByRole('button', { name: 'Edit Oil and hone the chisels' }).click()
await page.getByRole('button', { name: 'Remove reminder' }).click()
await page.waitForTimeout(300)
ok('removing takes it off the list', (await page.locator('.reminder-group .reminder-row', { hasText: 'hone the chisels' }).count()) === 0)
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(300)
ok('and Undo puts it back', (await page.locator('.reminder-group .reminder-row', { hasText: 'hone the chisels' }).count()) === 1)

await page.getByRole('button', { name: 'Mark Call Jim done' }).click()
await page.waitForTimeout(300)
items = await rows('sienaItems')
ok('completing still uses the same completion as everywhere', !!items.find((i) => i.id === 'soon')?.completedAt && !items.find((i) => i.id === 'soon')?.resolvedAt)

await page.getByRole('button', { name: 'Edit Oil and hone the chisels' }).click()
await page.getByRole('button', { name: 'Remove reminder' }).click()
await page.waitForTimeout(400)
await page.goto(BASE + '/archive')
await page.waitForTimeout(700)
const archive = await page.locator('.archive-items').textContent()
ok('the Archive shows a removed reminder as removed', archive.includes('Removed'))
ok('but never an edit’s old copy', !archive.includes('Oil the chisels'))

/* Going back to where the app was put down. */
const resumed = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await resumed.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))
const app = await resumed.newPage()
await app.goto(BASE + '/reminders')
await app.waitForTimeout(800)
await app.evaluate(() => window.dispatchEvent(new Event('pagehide')))
await app.goto(BASE + '/')
await app.waitForTimeout(800)
ok('an installed app launched soon after is back where it was put down', new URL(app.url()).pathname === '/reminders')
/* Leaving a page records it again, so the hours-old record is planted at the
   start of the next load, before the app reads it. */
await resumed.addInitScript(() => {
  if (sessionStorage.getItem('plant-old-place'))
    localStorage.setItem('field-notes.place', JSON.stringify({ path: '/reminders', at: Date.now() - 3 * 3600_000 }))
})
await app.evaluate(() => sessionStorage.setItem('plant-old-place', '1'))
await app.goto(BASE + '/')
await app.waitForTimeout(800)
ok('hours later it opens on Today', new URL(app.url()).pathname === '/')

ok('no page errors', problems.length === 0, problems.join(' | '))
await browser.close()
if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
console.log('\ndaily use: all passed')
