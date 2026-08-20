/* Sync checks, in two halves.

   The first half runs on node with nothing around it, because the whole
   decision sync makes is a pure function and there is no reason to need a
   browser to prove a truth table.

   The second half drives two real browsers against a fake mirror held in this
   file. It exists because the rule that matters here isn't "does a row move" —
   it's the one from the architecture note: nothing is ever lost, including
   when sync breaks. So the interesting tests are the ones where it breaks.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=http://localhost:5173 npm run check */

import { createHash } from 'node:crypto'
import { decide, samePage, conflictBody } from '../src/sync/reconcile.ts'
import {
  decodeCode,
  encodeCode,
  looksLikeProjectUrl,
  newVaultKey,
  normaliseUrl,
  vaultIdFor,
} from '../src/sync/pairing.ts'

const BASE = process.env.BASE ?? 'http://localhost:4173'

let failures = 0
const problems = []
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── the decision, on its own ───────────────────────────────────────────── */

const facts = (over = {}) => ({
  hasLocal: true,
  hasRemote: true,
  localUpdated: 100,
  remoteUpdated: 100,
  marked: 100,
  identical: false,
  remoteDeleted: false,
  ...over,
})

ok('an untouched page on both sides does nothing', decide(facts()) === 'none')

ok(
  'a page only this device changed is pushed',
  decide(facts({ hasRemote: false, localUpdated: 200 })) === 'push',
)

ok(
  'a page nobody changed is left alone even when the mirror is silent',
  decide(facts({ hasRemote: false })) === 'none',
)

ok(
  'a page only the mirror changed is applied',
  decide(facts({ remoteUpdated: 200 })) === 'apply',
)

ok(
  'a page this device has never seen arrives',
  decide(facts({ hasLocal: false, marked: undefined })) === 'apply',
)

ok(
  'a tombstone for a page this device never held is ignored',
  decide(facts({ hasLocal: false, marked: undefined, remoteDeleted: true })) === 'none',
)

ok(
  'a tombstone for a page this device does hold is applied',
  decide(facts({ remoteUpdated: 200, remoteDeleted: true })) === 'apply',
)

/* The rule the whole thing exists for. */
ok(
  'two edits at once keep the newer page and copy the older',
  decide(facts({ localUpdated: 300, remoteUpdated: 200 })) === 'keep-local' &&
    decide(facts({ localUpdated: 200, remoteUpdated: 300 })) === 'keep-remote',
)

ok(
  'two edits that reached the same text are not a conflict',
  decide(facts({ localUpdated: 300, remoteUpdated: 200, identical: true })) === 'push' &&
    decide(facts({ localUpdated: 200, remoteUpdated: 300, identical: true })) === 'apply',
)

/* A device that has never synced this row has no agreement to compare
   against, so everything it holds is dirty and everything the mirror holds
   has moved — which is the first-pair case, and it must not silently pick a
   side. */
ok(
  'a first pairing with text on both sides keeps both',
  decide(facts({ marked: undefined, localUpdated: 300, remoteUpdated: 200 })) === 'keep-local',
)

const base = {
  id: 'a',
  notebook: 'field-notes',
  body: 'One',
  created: 1,
  updated: 1,
  pinned: 0,
}
ok('the same page is the same page', samePage(base, { ...base, updated: 999 }))
ok('different writing is a different page', !samePage(base, { ...base, body: 'Two' }))
ok('a pin is part of it', !samePage(base, { ...base, pinned: 1 }))
ok('a tombstone is part of it', !samePage(base, { ...base, deleted: 5 }))
ok(
  'an unset pen and an ink pen are the same page',
  samePage({ ...base, pen: undefined }, { ...base }),
)

const copy = conflictBody('The evening I wrote.', '17 Aug 2026')
ok(
  'a conflict copy keeps every word and says what it is',
  copy.includes('The evening I wrote.') && copy.includes('#conflict') && copy.startsWith('>'),
  copy.split('\n')[0],
)

/* ── the pairing code ───────────────────────────────────────────────────── */

const key = newVaultKey()
ok('a vault key is 256 bits of randomness', key.length >= 42 && key !== newVaultKey(), key.length)

const id = await vaultIdFor(key)
ok('a vault id is the sha-256 of its key', id === createHash('sha256').update(key).digest('hex'))
ok('and it is the same every time', id === (await vaultIdFor(key)))

const code = encodeCode({ url: 'https://abc.supabase.co', anonKey: 'anon-key-value', key })
const decoded = await decodeCode(code)
ok(
  'a pairing code carries the whole vault and nothing else',
  decoded.url === 'https://abc.supabase.co' &&
    decoded.anonKey === 'anon-key-value' &&
    decoded.key === key &&
    decoded.id === id,
)
ok('and survives being pasted with whitespace in it', (await decodeCode(` ${code}\n`)).key === key)

for (const [name, bad] of [
  ['something that is not a code', 'hello'],
  ['a code that lost its tail', code.slice(0, code.length - 12)],
]) {
  let threw = false
  try {
    await decodeCode(bad)
  } catch {
    threw = true
  }
  ok(`${name} is refused`, threw)
}

ok(
  'a project URL survives a trailing slash and a rest path',
  normaliseUrl('https://abc.supabase.co/') === 'https://abc.supabase.co' &&
    normaliseUrl('https://abc.supabase.co/rest/v1') === 'https://abc.supabase.co',
)
ok(
  'and something that is not one is caught before it is stored',
  looksLikeProjectUrl('https://abc.supabase.co') && !looksLikeProjectUrl('abc.supabase.co'),
)

/* ── two devices and a fake mirror ──────────────────────────────────────── */

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

/* The mirror. Enough PostgREST to be honest about the contract the transport
   is written against: a cursor over a server-side stamp, an upsert on the
   primary key, and a fetch by id. The stamp is a counter and not a clock, so
   the ordering the cursor depends on is exact rather than lucky. */
const store = new Map()
let seq = 0
const T0 = Date.UTC(2026, 0, 1)
const stamp = () => new Date(T0 + ++seq).toISOString()
const offline = new Set()
/* A browser refusing to send a custom header — which is what a CORS preflight
   failure looks like from inside the app, and is indistinguishable from an
   unreachable host unless something goes and asks. */
const headerBlocked = new Set()
let served = 0

function handler(label) {
  return async (route, request) => {
    if (offline.has(label)) return route.abort('failed')
    if (headerBlocked.has(label) && request.headers()['x-vault-key']) {
      return route.abort('failed')
    }
    served++

    const url = new URL(request.url())
    const table = url.pathname.split('/').filter(Boolean).pop()

    /* The whole of the authentication, and the thing the row policy compares.

       Faithful to what a row policy actually does, which is not the same as a
       doorman: a read is *filtered* to the vault the key hashes to and returns
       nothing when it doesn't match, while a write is genuinely rejected,
       because that is `using` and `with check` doing two different jobs. A
       request with no key at all hashes the empty string — exactly the
       `coalesce(..., '')` in the schema — and so matches nothing real.

       Getting this right matters beyond fidelity: it is what lets the app tell
       "the header never arrived" apart from "the project is not there". */
    const presented = request.headers()['x-vault-key']
    const allowed = createHash('sha256')
      .update(presented ?? '')
      .digest('hex')

    if (request.method() === 'POST') {
      const rows = request.postDataJSON()
      if (rows.some((row) => row.vault !== allowed)) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
      }
      for (const row of rows) {
        store.set(`${table}|${row.vault}|${row.id}`, { ...row, server_at: stamp() })
      }
      return route.fulfill({ status: 201, body: '' })
    }

    /* Rows the policy would let this caller see, then the caller's own filter
       on top — which is why a mismatched vault comes back empty, not refused. */
    const vault = (url.searchParams.get('vault') ?? allowed).replace(/^eq\./, '')
    if (vault !== allowed) return json(route, [])

    const mine = [...store.entries()]
      .filter(([k]) => k.startsWith(`${table}|${vault}|`))
      .map(([, v]) => v)

    const inList = url.searchParams.get('id')
    if (inList?.startsWith('in.')) {
      const wanted = new Set(
        inList
          .slice(4, -1)
          .split(',')
          .map((s) => s.replace(/^"|"$/g, '')),
      )
      return json(route, mine.filter((row) => wanted.has(row.id)))
    }

    const cursor = (url.searchParams.get('server_at') ?? '').replace(/^gte\./, '')
    const limit = Number(url.searchParams.get('limit') ?? 200)
    return json(
      route,
      mine
        .filter((row) => row.server_at >= cursor)
        .sort((a, b) => a.server_at.localeCompare(b.server_at))
        .slice(0, limit),
    )
  }
}

const json = (route, body) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function device(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route('**/rest/v1/**', handler(label))
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(`${label}: ${e.message}`))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(900)
  return { label, context, view }
}

const settings = async (d) => {
  await d.view.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
  await d.view.waitForTimeout(450)
}

const syncNow = async (d) => {
  await settings(d)
  await d.view.locator('.btn.caps', { hasText: 'Sync now' }).click()
  await d.view.waitForTimeout(1100)
}

const titles = async (d) => {
  await d.view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await d.view.waitForTimeout(550)
  return d.view.locator('.list-row-title').allTextContents()
}

const write = async (d, text) => {
  await d.view.locator('.cm-content').click()
  await d.view.keyboard.press('Control+End')
  await d.view.keyboard.type(text, { delay: 8 })
  await d.view.waitForTimeout(400)
  /* Leaving the page flushes the save, which is what a real hand does too. */
  await d.view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await d.view.waitForTimeout(700)
}

const a = await device('A')
const b = await device('B')

/* ── the ceremony, once per device ──────────────────────────────────────── */

await settings(a)
ok('a device with no vault says so plainly', (await a.view.locator('.sync-form').count()) === 1)

await a.view.locator('.btn.caps', { hasText: 'First device' }).click()
await a.view.locator('#sync-url').fill('https://mirror.supabase.co')
await a.view.locator('#sync-anon').fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public')
await a.view.locator('.btn.caps', { hasText: 'Make the vault' }).click()
await a.view.waitForTimeout(2200)

ok('the first device makes a vault without signing in to anything', served > 0, `${served} calls`)
ok(
  'and there is no field anywhere for an email or a password',
  (await a.view.locator('input[type=password], input[type=email]').count()) === 0,
)

await a.view.locator('.btn.caps', { hasText: 'Pair another device' }).click()
await a.view.waitForTimeout(300)
const pairing = (await a.view.locator('.sync-code').textContent()).trim()
ok('it hands out a pairing code', pairing.startsWith('fn1.'), pairing.slice(0, 12))

await settings(b)
await b.view.locator('.btn.caps', { hasText: 'Already has it' }).click()
await b.view.locator('#sync-code').fill(pairing)
await b.view.locator('.btn.caps', { hasText: 'Pair this device' }).click()
await b.view.waitForTimeout(2600)
ok('the second device pairs from the code alone', (await b.view.locator('.sync-form').count()) === 0)

const seeded = await titles(b)
ok(
  "and does not bring its own first-run page into someone else's vault",
  seeded.filter((t) => t.includes('The first morning')).length === 1,
  seeded.join(' / '),
)

/* ── a page written on one device turns up on the other ─────────────────── */

await a.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(600)
await a.view.getByText('New page', { exact: true }).first().click()
await a.view.waitForTimeout(700)
await write(a, 'Ryedale in October')

await syncNow(a)
await syncNow(b)
const onB = await titles(b)
ok(
  'a page written on one device turns up on the other',
  onB.some((t) => t.includes('Ryedale in October')),
  onB.join(' / '),
)

/* ── the mirror going away changes nothing about writing ────────────────── */

offline.add('B')
await b.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await b.view.waitForTimeout(600)
await b.view.getByText('New page', { exact: true }).first().click()
await b.view.waitForTimeout(700)
const started = Date.now()
await b.view.locator('.cm-content').click()
await b.view.keyboard.type('Written with the wifi off', { delay: 8 })
const typed = Date.now() - started
ok('a page still opens and takes text with the mirror gone', typed < 4000, `${typed}ms`)
/* Long enough for the local save's own debounce and nothing longer — the
   point being measured above is that the keystrokes never waited on it. */
await b.view.waitForTimeout(500)
await b.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await b.view.waitForTimeout(900)
ok(
  'and the writing is on the device regardless',
  (await titles(b)).some((t) => t.includes('Written with the wifi off')),
)

await settings(b)
await b.view.locator('.btn.caps', { hasText: 'Sync now' }).click()
await b.view.waitForTimeout(1500)
ok(
  'sync says it is offline rather than raising anything',
  (await b.view.locator('.panel-card .meta').first().textContent()).includes('offline'),
)

offline.delete('B')
await syncNow(b)
await syncNow(a)
ok(
  'and catches up by itself once the mirror is back',
  (await titles(a)).some((t) => t.includes('Written with the wifi off')),
)

/* ── a mirror that is reachable but refuses the header ──────────────────── */

/* The failure that looks exactly like weather and isn't. Calling this one
   "offline — it will catch up" is how a setup that will still be broken
   tomorrow gets to look like a passing cloud, so the app goes and asks a
   plainer question before it decides which it was. */
headerBlocked.add('B')
await settings(b)
await b.view.locator('.btn.caps', { hasText: 'Sync now' }).click()
await b.view.waitForTimeout(1800)

const verdict = await b.view.locator('.panel-card .meta').first().textContent()
const explained = await b.view.locator('.sync-problem').first().textContent()
ok(
  'a refused header is not reported as weather',
  !verdict.toLowerCase().includes('offline'),
  verdict.trim(),
)
ok(
  'and the app works out that the header is the thing',
  /header|cors/i.test(explained ?? ''),
  (explained ?? '').trim(),
)

headerBlocked.delete('B')
await syncNow(b)
ok(
  'and it recovers once the header gets through',
  (await b.view.locator('.panel-card .meta').first().textContent()).includes('paired'),
)

/* ── the one that matters: both devices, the same page, no network ──────── */

const target = (await titles(a)).find((t) => t.includes('Ryedale in October'))
ok('both devices are holding the same page', !!target && (await titles(b)).includes(target))

offline.add('A')
await a.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(600)
await a.view.locator('.list-row', { hasText: 'Ryedale in October' }).first().click()
await a.view.waitForTimeout(700)
await write(a, '\nthe beck was full')

/* B edits the same page afterwards, and reaches the mirror first. */
await b.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await b.view.waitForTimeout(600)
await b.view.locator('.list-row', { hasText: 'Ryedale in October' }).first().click()
await b.view.waitForTimeout(700)
await write(b, '\nfrost on the gate')
await syncNow(b)

offline.delete('A')
await syncNow(a)

const bodies = await a.view.evaluate(async () => {
  const open = indexedDB.open('field-notes')
  const db = await new Promise((resolve) => {
    open.onsuccess = () => resolve(open.result)
  })
  const rows = await new Promise((resolve) => {
    const request = db.transaction('pages').objectStore('pages').getAll()
    request.onsuccess = () => resolve(request.result)
  })
  return rows.filter((p) => !p.deleted).map((p) => p.body)
})

ok(
  'the newer version of the page wins',
  bodies.some((body) => body.includes('Ryedale in October') && body.includes('frost on the gate')),
)
ok(
  'and the older one is kept rather than discarded',
  bodies.some((body) => body.includes('the beck was full')),
  `${bodies.length} pages`,
)
ok(
  'the copy says what it is, in the same notebook',
  bodies.some((body) => body.startsWith('> Conflicting copy') && body.includes('#conflict')),
)

await syncNow(a)
await syncNow(b)
const copied = await titles(b)
ok(
  'and the copy reaches the other device too',
  copied.some((t) => t.includes('Conflicting copy')),
  copied.join(' / '),
)

/* ── a deletion crosses, and does not walk back in ──────────────────────── */

await a.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(600)
await a.view.locator('.list-row', { hasText: 'Written with the wifi off' }).first().click()
await a.view.waitForTimeout(700)
await a.view.locator('[aria-label="Page options"]').click()
await a.view.waitForTimeout(300)
await a.view.locator('.sheet-item', { hasText: 'Delete page' }).first().click()
await a.view.waitForTimeout(900)

await syncNow(a)
await syncNow(b)
const afterDelete = await titles(b)
ok(
  'a page deleted on one device leaves the other',
  !afterDelete.some((t) => t.includes('Written with the wifi off')),
  afterDelete.join(' / '),
)
ok(
  'and it is in the trash there rather than gone',
  await b.view.evaluate(async () => {
    const open = indexedDB.open('field-notes')
    const db = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result)
    })
    const rows = await new Promise((resolve) => {
      const request = db.transaction('pages').objectStore('pages').getAll()
      request.onsuccess = () => resolve(request.result)
    })
    return rows.some((p) => p.deleted && p.body.includes('Written with the wifi off'))
  }),
)

/* ── a picture crosses as bytes, not as a broken link ───────────────────── */

/* Pictures ride as base64 in the same table as everything else, which is one
   transport and one row policy rather than two — and it is exactly the sort of
   thing that looks fine until the bytes come back a third larger and empty. */
const pngPath = await (async () => {
  const { writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { deflateSync, crc32 } = await import('node:zlib')
  const w = 24
  const h = 24
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 180)])),
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
  const path = join(tmpdir(), 'field-notes-sync.png')
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
  return path
})()

await a.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(600)
await a.view.getByText('New page', { exact: true }).first().click()
await a.view.waitForTimeout(700)
await a.view.locator('.cm-content').click()
await a.view.keyboard.type('Beck in spate', { delay: 8 })
await a.view.locator('.mark-button[aria-label="Style"]').click()
await a.view.waitForTimeout(250)
await a.view.locator('.tray input[type=file]').setInputFiles(pngPath)
await a.view.waitForTimeout(1200)
await a.view.goto(BASE, { waitUntil: 'domcontentloaded' })
await a.view.waitForTimeout(700)

await syncNow(a)
await syncNow(b)

const pictures = await b.view.evaluate(async () => {
  const open = indexedDB.open('field-notes')
  const db = await new Promise((resolve) => {
    open.onsuccess = () => resolve(open.result)
  })
  const rows = await new Promise((resolve) => {
    const request = db.transaction('images').objectStore('images').getAll()
    request.onsuccess = () => resolve(request.result)
  })
  return rows.map((row) => ({ id: row.id, size: row.blob.size, type: row.type }))
})

const sent = (await import('node:fs')).statSync(pngPath).size
ok(
  'a picture crosses byte for byte',
  pictures.length === 1 && pictures[0].size === sent && pictures[0].type === 'image/png',
  `${JSON.stringify(pictures)} against ${sent} sent`,
)

const withPicture = await titles(b)
ok(
  'the page carrying it came across too',
  withPicture.some((t) => t.includes('Beck in spate')),
  withPicture.join(' / '),
)

await b.view.locator('.list-row', { hasText: 'Beck in spate' }).first().click()
await b.view.waitForTimeout(1000)
ok(
  'and draws on the other device rather than dangling',
  await b.view
    .locator('.md-plate-image')
    .first()
    .evaluate((el) => el.complete && el.naturalWidth > 0)
    .catch(() => false),
)

/* ── unpairing keeps the writing ────────────────────────────────────────── */

const before = (await titles(b)).length
await settings(b)
await b.view.locator('.btn.caps', { hasText: 'Unpair' }).click()
await b.view.waitForTimeout(300)
await b.view.locator('.outline.danger', { hasText: 'Unpair it' }).click()
await b.view.waitForTimeout(900)
ok('unpairing puts the device back to not set up', (await b.view.locator('.sync-form').count()) === 1)
ok('and takes none of the writing with it', (await titles(b)).length === before, `${before}`)

await a.context.close()
await b.context.close()
await browser.close()

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
