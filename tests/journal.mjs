/* The journal, in the same two halves everything else in here uses.

   What a week *reads as* is a pure function over pages and runs on node with
   nothing around it — `src/lib/digest.ts` has no Dexie, no fetch and no clock
   in it for exactly this reason, the same way `sync/reconcile.ts` doesn't.

   The rest needs a browser, because the two things most likely to be wrong are
   the migration onto a database that already exists and the promise that
   collecting the same week twice leaves one page. A fresh install passes the
   migration whether or not the migration works, so this deletes the row and
   makes the app put it back.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=... node tests/journal.mjs */

import { digestOf, lastWeekAt, weekStart } from '../src/lib/digest.ts'

const BASE = process.env.BASE ?? 'http://localhost:4173'

let failures = 0
const problems = []
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── what a week reads as, on node ──────────────────────────────────────

   Sunday 16 August 2026 through Saturday the 22nd. Every timestamp is built
   from local parts rather than from an ISO string, because `dayOf` reads a
   local date and a `Z` here would put half these pages in the wrong week on
   half the machines that run this. */

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime()
const NAMES = { 'field-notes': 'Field Notes', workshop: 'The Workshop' }
const nameOf = (id) => NAMES[id] ?? 'Notebook'

const page = (over) => ({
  id: 'x',
  notebook: 'field-notes',
  body: 'A page',
  created: at(2026, 8, 17),
  updated: at(2026, 8, 17),
  pinned: 0,
  ...over,
})

const WEEK = [
  page({ id: 'a', created: at(2026, 8, 17, 9), body: '# The tent held\n\nRope and rain. #camp' }),
  page({
    id: 'b',
    notebook: 'workshop',
    created: at(2026, 8, 17, 16),
    body: '# The lathe\n\nA second bearing. #shop',
  }),
  page({ id: 'c', created: at(2026, 8, 20), body: '# Thursday\n\nQuiet.' }),
  /* Outside the week on both sides. */
  page({ id: 'before', created: at(2026, 8, 15), body: '# Saturday before' }),
  page({ id: 'after', created: at(2026, 8, 23), body: '# Sunday after' }),
  /* A tombstone, and the journal's own entry for this very week — which must
     not be gathered back into itself, or an entry would grow by a week every
     time it was collected. */
  page({ id: 'gone', created: at(2026, 8, 18), body: '# Deleted', deleted: at(2026, 8, 19) }),
  page({
    id: 'own',
    notebook: 'journal',
    created: at(2026, 8, 18),
    entryDate: '2026-08-16',
    body: '# 16–22 August 2026',
  }),
]

const monday = at(2026, 8, 17)
const d = digestOf(monday, WEEK, nameOf)

/* The headings go through `Intl`, so what they say depends on the machine's
   locale — "16–22 August 2026" here and "August 16 – August 22, 2026"
   somewhere else. Both are right; asserting on either would make this file
   pass in one country. So the assertions are on the parts, not the sentence. */
const has = (text, ...bits) => bits.every((bit) => text.includes(bit))
const heading = d.body.split('\n')[0]
const lines = d.body.split('\n')
const sections = lines.filter((l) => l.startsWith('## '))

ok('a week is named by its Sunday', d.week === '2026-08-16' && weekStart(monday) === '2026-08-16')
ok(
  'the heading is the week, both ends of it and the year',
  heading.startsWith('# ') && has(heading, '16', '22', 'August', '2026'),
  heading,
)
ok('it gathers what is inside the week', d.pages === 3, `${d.pages}`)
ok(
  'and nothing outside it, deleted in it, or written by it',
  !d.body.includes('Saturday before') &&
    !d.body.includes('Sunday after') &&
    !d.body.includes('Deleted') &&
    !d.body.includes('### 16'),
)
ok(
  'a day that had pages gets a section and a day that did not gets nothing',
  sections.length === 2 &&
    has(sections[0], 'Monday', '17') &&
    has(sections[1], 'Thursday', '20'),
  sections.join(' / '),
)
ok(
  'each page arrives under its own title with its notebook named',
  d.body.includes('### The tent held\n\n*Field Notes*') &&
    d.body.includes('### The lathe\n\n*The Workshop*'),
)
ok(
  'and in full, because this is raw material rather than a summary',
  d.body.includes('Rope and rain. #camp') && d.body.includes('A second bearing. #shop'),
)
ok('the week is in the order it happened', d.body.indexOf('The tent held') < d.body.indexOf('The lathe'))
ok('the week\'s tags are gathered at the foot', d.body.trimEnd().endsWith('#camp #shop'))

/* Pictures. The bytes live in Dexie beside the page they were pasted into, so
   a link carried across would be dead in the journal's own export folder. */
const withPicture = digestOf(
  monday,
  [page({ id: 'p', created: at(2026, 8, 17), body: 'Look\n\n![the tent](images/abc.jpg){right 44}' })],
  nameOf,
)
ok(
  'a picture leaves its caption behind and takes its link with it',
  withPicture.body.includes('the tent') && !withPicture.body.includes('images/abc.jpg'),
)

/* Empty weeks and idempotence of the pure part. */
const empty = digestOf(at(2026, 8, 17), [], nameOf)
ok('a week nothing was written in still says so', empty.pages === 0 && empty.body.includes('Nothing was written'))
ok(
  'the same week twice is the same page, character for character',
  digestOf(at(2026, 8, 17, 9), WEEK, nameOf).body === digestOf(at(2026, 8, 22, 23), WEEK, nameOf).body,
)
ok(
  'every day of the week names the same Sunday',
  [16, 17, 18, 19, 20, 21, 22].every((day) => weekStart(at(2026, 8, day)) === '2026-08-16'),
)
ok(
  'and last week is the week before this one, not the one three hours old',
  weekStart(lastWeekAt(at(2026, 8, 17))) === '2026-08-09',
)

/* ── the database, in a browser ─────────────────────────────────────────── */

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

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const view = await context.newPage()
view.on('pageerror', (e) => problems.push(e.message))
await view.goto(BASE, { waitUntil: 'domcontentloaded' })
await view.waitForTimeout(1200)

/* Raw IndexedDB, so the test doesn't need the app's modules to agree with it
   about what is stored. */
const notebookIds = () =>
  view.evaluate(async () => {
    const open = indexedDB.open('field-notes')
    const dbi = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const rows = await new Promise((res, rej) => {
      const r = dbi.transaction('notebooks').objectStore('notebooks').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    dbi.close()
    return rows.map((n) => ({ id: n.id, updated: n.updated, deleted: n.deleted ?? null }))
  })

{
  const rows = await notebookIds()
  const journal = rows.find((n) => n.id === 'journal')
  ok('a fresh device seeds the journal alongside the four', !!journal)
  ok(
    'stamped 0, so two devices that stood it up before pairing have nothing to argue about',
    journal?.updated === 0,
    String(journal?.updated),
  )
  ok('and it is not on the shelf', (await view.locator('.rail-books .book-row:not(.book-add)').count()) === 4)
  ok('it is below the rule instead', (await view.locator('.rail-foot .rail-journal').count()) === 1)

  await view.locator('.rail-books-head .link-caps').click()
  await view.waitForTimeout(300)
  ok(
    'and the manager does not offer to rename, recolour or delete it',
    (await view.locator('.manager-row .manager-name').allTextContents()).every(
      (n) => n !== 'Journal',
    ),
  )
  await view.locator('.manager-head .mark-button').click()
  await view.waitForTimeout(200)
}

/* ── the migration, against a database that already exists ──────────────
   A fresh install passes this whether or not the migration works, which is why
   the row is taken out from underneath the app and the app made to put it back
   on the next boot. `loadNotebooks` only ever seeded an empty table, so adding
   an entry to DEFAULT_NOTEBOOKS would have done nothing here. */

{
  await view.evaluate(async () => {
    const open = indexedDB.open('field-notes')
    const dbi = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const tx = dbi.transaction('notebooks', 'readwrite')
    tx.objectStore('notebooks').delete('journal')
    await new Promise((res, rej) => {
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
    dbi.close()
  })
  const gone = await notebookIds()
  ok('the row can be taken out from underneath it', !gone.some((n) => n.id === 'journal'))

  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1200)
  const back = await notebookIds()
  ok(
    'and a database that already existed gets it on the next boot',
    back.some((n) => n.id === 'journal' && n.updated === 0),
  )
  ok('with no second copy of anything else', back.filter((n) => n.id === 'journal').length === 1)
}

/* ── collecting ─────────────────────────────────────────────────────────── */

const journalPages = () =>
  view.evaluate(async () => {
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
      .filter((p) => p.notebook === 'journal' && !p.deleted)
      .map((p) => ({ id: p.id, entryDate: p.entryDate, body: p.body }))
  })

{
  /* A page in last week, so there is something to gather. */
  await view.evaluate(async () => {
    const sunday = new Date()
    sunday.setHours(12, 0, 0, 0)
    sunday.setDate(sunday.getDate() - sunday.getDay() - 3)
    const open = indexedDB.open('field-notes')
    const dbi = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const tx = dbi.transaction('pages', 'readwrite')
    tx.objectStore('pages').put({
      id: 'jrnl-source',
      notebook: 'field-notes',
      body: '# The kiln\n\nFired it twice. #shop',
      created: sunday.getTime(),
      updated: sunday.getTime(),
      pinned: 0,
    })
    await new Promise((res, rej) => {
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
    dbi.close()
  })
  await view.reload({ waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1200)

  await view.locator('.rail-foot .rail-journal').click()
  await view.waitForTimeout(400)
  ok(
    'the journal opens with its own button at the foot, not New page',
    (await view.locator('.list-foot .plate-button').textContent()) === 'Collect last week',
  )

  await view.locator('.list-foot .plate-button').click()
  await view.waitForTimeout(1400)
  const first = await journalPages()
  ok('collecting a week makes one page', first.length === 1)
  ok('it gathered the week it was asked for', first[0]?.body.includes('The kiln'))
  ok(
    'it sits on the week\'s Sunday',
    !!first[0]?.entryDate && new Date(`${first[0].entryDate}T12:00:00`).getDay() === 0,
    first[0]?.entryDate,
  )
  ok('and it opened the entry', (await view.locator('.cm-content').count()) === 1)

  /* Again. The whole point of keying on notebook plus entryDate. */
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1000)
  await view.locator('.rail-foot .rail-journal').click()
  await view.waitForTimeout(400)
  await view.locator('.list-foot .plate-button').click()
  await view.waitForTimeout(1400)
  const second = await journalPages()
  ok('collecting the same week twice leaves one entry', second.length === 1, `${second.length}`)
  ok('and it is the same page, not a replacement', second[0]?.id === first[0]?.id)
}

/* ── in the calendar ────────────────────────────────────────────────────── */

{
  const entry = (await journalPages())[0]
  const title = entry.body.split('\n')[0].replace(/^#\s*/, '')
  const month = entry.entryDate.slice(0, 7)
  await view.goto(`${BASE}/calendar/${month}`, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1000)

  ok('the month carries a strip of its journal entries', (await view.locator('.calendar-journal-row').count()) >= 1)
  ok(
    'and the entry is also down among the days, because it is a page and the calendar is a lens',
    (await view.locator(`.calendar-day .row-page:has-text("${title}")`).count()) === 1,
  )
  ok(
    'the strip sits above the day groups rather than under them',
    await view.evaluate(() => {
      const strip = document.querySelector('.calendar-journal')?.getBoundingClientRect()
      const day = document.querySelector('.calendar-day')?.getBoundingClientRect()
      return !!strip && !!day && strip.bottom <= day.top + 1
    }),
  )
  ok(
    'and an entry puts no ring on its Sunday, because nothing was written that day',
    await view.evaluate((iso) => {
      const cell = document.querySelector(`.cal-day[aria-label="${iso}"]`)
      return !!cell && !cell.classList.contains('written')
    }, entry.entryDate),
    entry.entryDate,
  )
}

await context.close()
await browser.close()

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
