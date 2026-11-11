/* The second daily-use pass (November 2026): sharing a page, undo after
   deleting one, the search fixes, and find in page.

   On node: what a shared page reads as, and where find looks.
   In a browser: the rest, with the system share sheet stood in for by a
   function that records what it was handed — a headless browser has none.

     npm run build && npm run preview &
     node tests/share-find.mjs */

import { readableText } from '../src/lib/share-text.ts'
import { findRanges } from '../src/editor/find-ranges.ts'

const BASE = process.env.BASE ?? 'http://localhost:4173'
let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── on node ─────────────────────────────────────────────────────────────── */
const page = [
  '# Porch bench',
  '',
  'Cut list for the **walnut** bench, =={brass}soon==.',
  '',
  '- [ ] two legs',
  '- [x] the slab',
  '  - planed',
  '1. glue',
  '> measure twice',
  '',
  '{table 70}',
  '| Part | Qty |',
  '| --- | :-: |',
  '| Leg | 2 |',
  '| < | ^ |',
  '',
  '![The slab](images/a1.png){right 40}',
  '{center}<u>Price</u> from [Reasor’s](https://reasors.com).',
].join('\n')
const text = readableText(page)
ok('a shared page has no markdown in it', !/[#*=<>{}|]|\]\(/.test(text.replace('│', '')), JSON.stringify(text))
ok('the title is plain', text.startsWith('Porch bench\n'))
ok('a checklist reads as boxes', text.includes('☐ two legs') && text.includes('☑ the slab'))
ok('nesting is kept', text.includes('\n  • planed'))
ok('a numbered list keeps its numbers', text.includes('1. glue'))
ok('a table reads as rows of cells', text.includes('Part  ·  Qty') && text.includes('Leg  ·  2') && !text.includes('---'))
ok('a picture reads as its caption', text.includes('The slab'))
ok('a link keeps its address after its words', text.includes('Price from Reasor’s (https://reasors.com).'))

const hay = 'See [the café](https://cafe.example) and =={brass}café== on the {center} line'
ok('find ignores case and accents', findRanges(hay, 'CAFE').length === 2)
ok('find never matches inside what the page hides', findRanges(hay, 'example').length === 0 && findRanges(hay, 'brass').length === 0)

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
const { chromium, devices } = await loadPlaywright()
const browser = await chromium.launch()
const problems = []
const context = await browser.newContext({ ...devices['iPhone 14'] })
await context.addInitScript(() => {
  window.__shared = []
  navigator.share = async (data) => {
    window.__shared.push({ title: data.title, text: data.text, files: (data.files ?? []).map((f) => `${f.name}:${f.type}`) })
  }
  navigator.canShare = () => true
})
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin })
const view = await context.newPage()
view.on('pageerror', (e) => problems.push(e.message))
await view.goto(BASE + '/')
await view.waitForTimeout(1000)

const write = (store, rows) =>
  view.evaluate(async ({ store, rows }) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('field-notes'); r.onsuccess = () => ok(r.result) })
    const tx = db.transaction(store, 'readwrite')
    for (const row of rows) tx.objectStore(store).put(row)
    await new Promise((ok) => (tx.oncomplete = ok))
  }, { store, rows })
const png = await view.evaluate(async () => {
  const blob = await (await fetch('/icon-192.png')).blob()
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
})
await view.evaluate(async (bytes) => {
  const db = await new Promise((ok) => { const r = indexedDB.open('field-notes'); r.onsuccess = () => ok(r.result) })
  const tx = db.transaction('images', 'readwrite')
  tx.objectStore('images').put({ id: 'a1', page: 'bench', blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }), type: 'image/png', ext: 'png', added: 1 })
  await new Promise((ok) => (tx.oncomplete = ok))
}, png)
const now = Date.now()
const long = ['# A long page', '', ...Array.from({ length: 200 }, (_, i) => `Paragraph ${i} about the porch and the lantern ${i % 7 === 0 ? 'beacon' : ''}.`), '', 'The very last line mentions a heron.']
await write('pages', [
  { id: 'bench', notebook: 'field-notes', body: page, created: now, updated: now, pinned: 0 },
  { id: 'long', notebook: 'church', body: long.join('\n\n'), created: now, updated: now, pinned: 0 },
  ...Array.from({ length: 90 }, (_, i) => ({ id: `fn-${i}`, notebook: 'field-notes', body: `# Note ${i}\n\nThe walnut ${i % 2 ? 'dovetail' : 'tenon'} again`, created: now, updated: now, pinned: 0 })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `ch-${i}`, notebook: 'church', body: `# Church ${i}\n\nThe walnut pew`, created: now - 1000, updated: now - 1000, pinned: 0 })),
])

/* Share */
await view.goto(BASE + '/p/bench')
await view.locator('.cm-content').waitFor()
await view.waitForTimeout(600)
await view.getByRole('button', { name: 'Page options' }).click()
await view.waitForTimeout(500)
await view.getByRole('button', { name: 'Share with 1 picture' }).click()
await view.waitForTimeout(300)
const shared = await view.evaluate(() => window.__shared)
ok('Share hands the page to the share sheet', shared.length === 1 && shared[0].title === 'Porch bench')
ok('as readable text', shared[0]?.text === text)
ok('with its picture', shared[0]?.files.length === 1 && shared[0].files[0].endsWith(':image/png'))

await view.getByRole('button', { name: 'Page options' }).click()
await view.waitForTimeout(400)
await view.getByRole('button', { name: 'Copy text' }).click()
await view.waitForTimeout(300)
ok('Copy text puts the same words on the clipboard', (await view.evaluate(() => navigator.clipboard.readText())) === text)
await view.keyboard.press('Escape')

/* A selection shares only itself. */
await view.locator('.cm-content').evaluate((el) => el.focus())
await view.evaluate(() => {
  const cm = document.querySelector('.cm-content').cmView?.view ?? null
  return !!cm
})
await view.locator('.cm-line', { hasText: 'two legs' }).click()
await view.keyboard.press('Home')
await view.keyboard.press('Shift+End')
await view.getByRole('button', { name: 'Page options' }).click()
await view.waitForTimeout(400)
await view.getByRole('button', { name: 'Share selection' }).click()
await view.waitForTimeout(300)
const picked = (await view.evaluate(() => window.__shared)).at(-1)
ok('Share selection shares only what was picked, as it reads', picked?.text === '☐ two legs', JSON.stringify(picked?.text))

/* Undo after deleting */
await view.getByRole('button', { name: 'Page options' }).click()
await view.waitForTimeout(400)
await view.getByRole('button', { name: 'Delete page' }).click()
await view.waitForTimeout(600)
ok('deleting a page says so, with Undo', (await view.locator('.pill-undoable').textContent())?.includes('Page deleted'))
await view.locator('.pill-undoable button').click()
await view.waitForTimeout(800)
const bench = (await view.evaluate(async () => {
  const db = await new Promise((ok) => { const r = indexedDB.open('field-notes'); r.onsuccess = () => ok(r.result) })
  return new Promise((ok) => { const r = db.transaction('pages').objectStore('pages').get('bench'); r.onsuccess = () => ok(r.result) })
}))
ok('Undo brings it back and opens it', !bench.deleted && new URL(view.url()).pathname === '/p/bench')

/* Find in page */
await view.goto(BASE + '/p/long')
await view.locator('.cm-content').waitFor()
await view.waitForTimeout(600)
await view.getByRole('button', { name: 'Page options' }).click()
await view.waitForTimeout(400)
await view.getByRole('button', { name: /Find in page/ }).click()
await view.keyboard.type('beacon')
await view.waitForTimeout(300)
ok('find counts every match on a long page', (await view.locator('.find-count').textContent()).endsWith('of 29'))
await view.fill('input[aria-label="Find in page"]', 'heron')
await view.waitForTimeout(400)
ok('and reaches the last line, which the browser had not drawn', await view.locator('.cm-find-current').isVisible())
const grid = await view.evaluate(() => {
  const lines = [...document.querySelectorAll('.cm-line')].filter((l) => l.querySelector('.cm-find-match'))
  return lines.map((l) => Math.round(l.getBoundingClientRect().height) % 28)
})
ok('a marked line stays on the 28px grid', grid.length > 0 && grid.every((r) => r === 0), JSON.stringify(grid))
await view.keyboard.press('Escape')
await view.waitForTimeout(300)
ok('Escape closes find and stays on the page', (await view.locator('.find-bar').count()) === 0 && new URL(view.url()).pathname === '/p/long')
ok('and leaves no marks behind', (await view.locator('.cm-find-match').count()) === 0)

/* Search */
await view.goto(BASE + '/search')
await view.waitForTimeout(500)
await view.keyboard.type('walnut')
await view.waitForTimeout(600)
ok('search counts every match', (await view.locator('.search-box span').textContent()) === '103 found')
await view.getByRole('button', { name: 'Church', exact: true }).click()
await view.waitForTimeout(600)
ok('a notebook filter finds all of that notebook’s matches', (await view.locator('.search-box span').textContent()) === '12 found')
await view.getByRole('button', { name: 'Church', exact: true }).click()
await view.fill('input[type=search]', 'walnut dovetail')
await view.waitForTimeout(600)
ok('a second word narrows', (await view.locator('.search-box span').textContent()) === '45 found')
ok('and every matched word is marked', (await view.locator('.search-hit').first().locator('mark').count()) >= 2)

ok('no page errors', problems.length === 0, problems.join(' | '))
await browser.close()
if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nshare and find: all passed')
