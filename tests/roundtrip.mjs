/* The round trip: export → fresh device → import → the same pages, byte for
   byte. Phase 03's rule is that a backup that has never been restored is not
   a backup; this file is the restore, run on every check, so the claim
   "markdown is the storage format" is proved in both directions rather than
   believed.

   Two browser contexts stand in for two devices. The first is written in,
   exports the shelf, and hands over a zip; the second is brand new, imports
   it, and has to end up holding the same archive. The awkward cases ride
   along on purpose: a notebook named `No` (a boolean to any careless YAML
   reader), a pinned felt-pen night page with an entry date, a picture whose
   bytes must cross intact, and a foreign file with no frontmatter at all.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=... node tests/roundtrip.mjs */

import { unzipSync, strFromU8 } from 'fflate'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:4173'

let failures = 0
const problems = []
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

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
const dir = mkdtempSync(join(tmpdir(), 'field-notes-roundtrip-'))

/* ── what crosses ───────────────────────────────────────────────────────── */

const JPEG = [255, 216, 255, 224, 7, 3, 5, 9, 2, 4, 6, 8, 1, 0, 255, 217]

const PAGES = [
  {
    id: 'rt-alpha',
    notebook: 'field-notes',
    body: '# The tent held\n\nThe =={brass}long thought== and **bold** rope. #camp',
    created: 1755500000000,
    updated: 1755600000000,
    pinned: 1,
    entryDate: '2026-03-14',
    pen: 'felt',
    stock: 'night',
  },
  {
    id: 'rt-beta',
    notebook: 'no-book',
    body: 'Release 2.0\n\nWhat shipped and what slipped.',
    created: 1755500100000,
    updated: 1755600100000,
    pinned: 0,
  },
  {
    id: 'rt-gamma',
    notebook: 'field-notes',
    body: 'Camp photo\n\n![camp](images/rtimg001.jpg){right 44}',
    created: 1755500200000,
    updated: 1755600200000,
    pinned: 0,
  },
]

const NOTEBOOKS = [{ id: 'no-book', name: 'No', color: '#530a28', order: 7, updated: 1 }]

const IMAGES = [
  { id: 'rtimg001', page: 'rt-gamma', type: 'image/jpeg', ext: 'jpg', added: 1755500200000, bytes: JPEG },
]

async function device() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  })
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(e.message))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1200)
  return { context, view }
}

/* Raw IndexedDB, because the tests must not need the app's modules to agree
   with them about what is stored. */
const readStores = async () => {
  const open = indexedDB.open('field-notes')
  const dbi = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const read = (store) =>
    new Promise((res, rej) => {
      const r = dbi.transaction(store).objectStore(store).getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const pages = await read('pages')
  const notebooks = await read('notebooks')
  const images = []
  for (const im of await read('images')) {
    images.push({
      id: im.id,
      page: im.page,
      ext: im.ext,
      type: im.type,
      bytes: Array.from(new Uint8Array(await im.blob.arrayBuffer())),
    })
  }
  dbi.close()
  return { pages, notebooks, images }
}

/* ── the first device writes and exports ────────────────────────────────── */

const a = await device()

await a.view.evaluate(async ({ pages, notebooks, images }) => {
  const open = indexedDB.open('field-notes')
  const dbi = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const tx = dbi.transaction(['pages', 'notebooks', 'images'], 'readwrite')
  for (const p of pages) tx.objectStore('pages').put(p)
  for (const n of notebooks) tx.objectStore('notebooks').put(n)
  for (const im of images) {
    const { bytes, ...rest } = im
    tx.objectStore('images').put({ ...rest, blob: new Blob([new Uint8Array(bytes)], { type: im.type }) })
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
  dbi.close()
}, { pages: PAGES, notebooks: NOTEBOOKS, images: IMAGES })

await a.view.reload({ waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(1200)
await a.view.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(600)

const [download] = await Promise.all([
  a.view.waitForEvent('download'),
  a.view.getByText('Whole shelf').click(),
])
const zipPath = join(dir, 'shelf.zip')
await download.saveAs(zipPath)
await a.context.close()

/* ── the zip itself, read on node ───────────────────────────────────────── */

const entries = unzipSync(new Uint8Array(readFileSync(zipPath)))
const names = Object.keys(entries)
const textOf = (part) => {
  const name = names.find((n) => n.includes(part))
  return name ? strFromU8(entries[name]) : ''
}

ok('the zip holds a folder per notebook', names.some((n) => n.startsWith('no/')), names.join(', '))
const beta = textOf('release-2')
ok('a notebook named No is quoted on the way out', beta.includes("notebook: 'No'"), beta.split('\n')[2])
ok('and every page carries its id', beta.includes("id: 'rt-beta'"))
ok(
  'the picture rides at the path the markdown says',
  names.some((n) => n.endsWith('images/rtimg001.jpg')),
)
const alpha = textOf('the-tent-held')
ok(
  'the envelope crosses whole',
  alpha.includes("date: '2026-03-14'") &&
    alpha.includes('pinned: true') &&
    alpha.includes("pen: 'felt'") &&
    alpha.includes("stock: 'night'"),
)

/* ── a fresh device imports it ──────────────────────────────────────────── */

const b = await device()
await b.view.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await b.view.waitForTimeout(600)

await b.view.locator('input[aria-label="Import files"]').setInputFiles(zipPath)
await b.view.waitForSelector('[data-import-report]')
const firstReport = await b.view.locator('[data-import-report]').textContent()

ok('the report says what came in', firstReport.includes('4 pages in'), firstReport)
ok('the picture with it', firstReport.includes('1 picture'), firstReport)
ok('and the notebook the shelf was missing', firstReport.includes('1 notebook added'), firstReport)

const after = await b.view.evaluate(readStores)
const bookName = (id) => after.notebooks.find((n) => n.id === id)?.name

for (const wanted of PAGES) {
  const got = after.pages.find((p) => p.id === wanted.id)
  ok(`${wanted.id} came back`, !!got)
  if (!got) continue
  ok(
    `${wanted.id} body is byte for byte`,
    got.body === wanted.body,
    JSON.stringify(got.body?.slice(-30)),
  )
  ok(
    `${wanted.id} keeps its dates`,
    got.created === wanted.created && got.updated === wanted.updated,
    `${got.created}/${got.updated}`,
  )
}

const alphaBack = after.pages.find((p) => p.id === 'rt-alpha')
ok(
  'the whole envelope survives',
  alphaBack?.pinned === 1 &&
    alphaBack?.entryDate === '2026-03-14' &&
    alphaBack?.pen === 'felt' &&
    alphaBack?.stock === 'night',
  JSON.stringify(alphaBack),
)
const betaBack = after.pages.find((p) => p.id === 'rt-beta')
ok(
  'No is a notebook, not a boolean',
  bookName(betaBack?.notebook) === 'No',
  String(bookName(betaBack?.notebook)),
)
ok(
  'and rt-alpha landed in the notebook of the same name, not a copy of it',
  bookName(alphaBack?.notebook) === 'Field Notes' &&
    after.notebooks.filter((n) => !n.deleted && n.name === 'Field Notes').length === 1,
)
const imageBack = after.images.find((im) => im.id === 'rtimg001')
ok(
  'the picture crossed byte for byte',
  !!imageBack && imageBack.bytes.join(',') === JPEG.join(',') && imageBack.page === 'rt-gamma',
  imageBack ? `${imageBack.bytes.length} bytes` : 'missing',
)

/* ── restoring twice gets one copy ──────────────────────────────────────── */

const countBefore = after.pages.length
await b.view.locator('input[aria-label="Import files"]').setInputFiles(zipPath)
await b.view.waitForFunction(
  () => document.querySelector('[data-import-report]')?.textContent?.includes('already here'),
)
const secondReport = await b.view.locator('[data-import-report]').textContent()
ok('the second restore is an upsert, not a second copy', secondReport.includes('4 already here'), secondReport)

const again = await b.view.evaluate(readStores)
ok('nothing was added', again.pages.length === countBefore, `${again.pages.length} vs ${countBefore}`)
ok(
  'and nothing was touched',
  again.pages.every((p) => {
    const was = after.pages.find((q) => q.id === p.id)
    return was && was.updated === p.updated && was.body === p.body
  }),
)

/* ── a foreign file, no frontmatter ─────────────────────────────────────── */

const foreignPath = join(dir, 'loose-leaf.md')
writeFileSync(foreignPath, 'Loose leaf\n\nFrom another hand.\n')
await b.view.locator('input[aria-label="Import files"]').setInputFiles(foreignPath)
await b.view.waitForFunction(
  () => document.querySelector('[data-import-report]')?.textContent?.includes('1 page in'),
)

const withForeign = await b.view.evaluate(readStores)
const foreign = withForeign.pages.find((p) => p.body.startsWith('Loose leaf'))
ok('a file with no frontmatter still becomes a page', !!foreign)
ok(
  'its body is the whole file, less the newline export would add back',
  foreign?.body === 'Loose leaf\n\nFrom another hand.',
  JSON.stringify(foreign?.body),
)
ok('it lands in the first notebook', bookName(foreign?.notebook) === 'Field Notes')
ok('with an invented id', !!foreign?.id && foreign.id.length >= 12)

await b.context.close()
await browser.close()

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
