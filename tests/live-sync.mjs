/* Live sync (November 2026): two things a page written on one device needs
   to reach another quickly.

   1. When the app is put down — on a phone, the home screen — a write made
      in that moment is pushed at once, not after the usual three-second pause
      the page may not be given before iOS freezes it.
   2. When one device pushes, it rings a doorbell, and a second device that is
      awake pulls straight away instead of waiting for its heartbeat.

   Two real browsers, a fake mirror (REST) and a fake Realtime socket, both
   held in this file. The socket understands just enough of the Phoenix
   protocol realtime-js speaks: a join, a heartbeat, and a broadcast, which
   the client sends as a binary frame and this fake hands to every other
   socket on the same channel as a text one.

     npm run build && npm run preview &
     node tests/live-sync.mjs */

import { createHash } from 'node:crypto'

const BASE = process.env.BASE ?? 'http://localhost:4173'
let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

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

/* ── the mirror ─────────────────────────────────────────────────────────── */
const store = new Map()
let seq = 0
const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++seq).toISOString()
const pushes = []
const json = (route, body) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

function mirror(label) {
  return async (route, request) => {
    const url = new URL(request.url())
    const table = url.pathname.split('/').filter(Boolean).pop()
    const vault = createHash('sha256').update(request.headers()['x-vault-key'] ?? '').digest('hex')
    if (request.method() === 'POST') {
      const rows = request.postDataJSON()
      for (const row of rows) store.set(`${table}|${row.vault}|${row.id}`, { ...row, server_at: stamp() })
      pushes.push({ label, table, at: Date.now(), bodies: rows.map((r) => r.body ?? '') })
      return route.fulfill({ status: 201, body: '' })
    }
    const mine = [...store.entries()].filter(([k]) => k.startsWith(`${table}|${vault}|`)).map(([, v]) => v)
    const inList = url.searchParams.get('id')
    if (inList?.startsWith('in.')) {
      const wanted = new Set(inList.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')))
      return json(route, mine.filter((row) => wanted.has(row.id)))
    }
    const cursor = (url.searchParams.get('server_at') ?? '').replace(/^gte\./, '')
    const limit = Number(url.searchParams.get('limit') ?? 200)
    return json(route, mine.filter((r) => r.server_at >= cursor).sort((a, b) => a.server_at.localeCompare(b.server_at)).slice(0, limit))
  }
}

/* ── the socket ─────────────────────────────────────────────────────────── */
const sockets = new Set()
let rings = 0
function realtime(ws) {
  const me = { ws, topics: new Set() }
  sockets.add(me)
  ws.onMessage((message) => {
    if (typeof message !== 'string') {
      /* A user broadcast push: [kind, ...lengths, joinRef, ref, topic, event, …]. */
      const bytes = new Uint8Array(message)
      const [kind, joinLen, refLen, topicLen] = bytes
      if (kind !== 3) return
      const start = 7 + joinLen + refLen
      const topic = new TextDecoder().decode(bytes.slice(start, start + topicLen))
      rings++
      for (const other of sockets) {
        if (other === me || !other.topics.has(topic)) continue
        other.ws.send(JSON.stringify([null, null, topic, 'broadcast', { type: 'broadcast', event: 'ring', payload: {} }]))
      }
      return
    }
    const [joinRef, ref, topic, event] = JSON.parse(message)
    if (event === 'phx_join') me.topics.add(topic)
    if (event === 'phx_leave') me.topics.delete(topic)
    ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]))
  })
  ws.onClose(() => sockets.delete(me))
}

async function device(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route('**/rest/v1/**', mirror(label))
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, realtime)
  const view = await context.newPage()
  await view.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(700)
  return { label, context, view }
}

const a = await device('A')
await a.view.getByRole('button', { name: 'First device', exact: true }).click()
await a.view.locator('#sync-url').fill('https://mirror.supabase.co')
await a.view.locator('#sync-anon').fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public')
await a.view.getByRole('button', { name: 'Make the vault', exact: true }).click()
await a.view.waitForTimeout(2200)
await a.view.getByRole('button', { name: 'Pair another device', exact: true }).click()
await a.view.waitForTimeout(300)
const code = (await a.view.locator('.sync-code').textContent()).trim()

const b = await device('B')
await b.view.getByRole('button', { name: 'Already has it', exact: true }).click()
await b.view.locator('#sync-code').fill(code)
await b.view.getByRole('button', { name: 'Pair this device', exact: true }).click()
await b.view.waitForTimeout(2600)
ok('both devices are paired', (await b.view.locator('.sync-form').count()) === 0)

/* Both sit open: A on a new page, B on the notebook list. */
await b.view.goto(BASE + '/n/field-notes', { waitUntil: 'domcontentloaded' })
await a.view.goto(BASE + '/new/field-notes', { waitUntil: 'domcontentloaded' })
await a.view.locator('.cm-content').waitFor()
await a.view.waitForTimeout(2500)
ok('each device has joined the doorbell channel', [...sockets].filter((s) => s.topics.size).length >= 2, `${sockets.size} sockets`)

/* ── 1: put down mid-sentence ──────────────────────────────────────────── */
await a.view.locator('.cm-content').click()
await a.view.keyboard.type('Picked up the walnut from the yard', { delay: 8 })
const before = pushes.length
await a.view.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  Object.defineProperty(document, 'hidden', { value: true, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('pagehide'))
})
const hiddenAt = Date.now()
let sent
for (let i = 0; i < 60 && !sent; i++) {
  await a.view.waitForTimeout(50)
  sent = pushes.slice(before).find((p) => p.label === 'A' && p.table === 'pages' && p.bodies.some((x) => x.includes('walnut from the yard')))
}
ok('a write made as the app is put down is pushed at once', !!sent && sent.at - hiddenAt < 1500, sent ? `${sent.at - hiddenAt} ms` : 'not within 3 s')

/* ── 2: the other device hears the bell ─────────────────────────────────── */
let arrived = false
const ringsBefore = rings
for (let i = 0; i < 40 && !arrived; i++) {
  await b.view.waitForTimeout(100)
  arrived = (await b.view.locator('.list-row-title').allTextContents()).some((t) => t.includes('Picked up the walnut'))
}
ok('the pushing device rang the doorbell', rings > ringsBefore || rings > 0, `${rings} rings`)
ok('the open device shows the new page within seconds, without a heartbeat', arrived)

await browser.close()
if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nlive sync: all passed')
