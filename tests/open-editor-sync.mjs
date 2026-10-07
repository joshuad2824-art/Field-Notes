/* Fresh profiles and an invented, intercepted mirror only. No live notes.
   EXPECT_BASELINE=1 BASE=http://127.0.0.1:4317 node tests/open-editor-sync.mjs */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const base = process.env.BASE ?? 'http://127.0.0.1:4318'
const baseline = process.env.EXPECT_BASELINE === '1'
const browser = await chromium.launch()
const key = 'disposable-open-editor-test-key-never-a-real-vault'
const vault = { url: 'https://disposable-field-notes.supabase.co', anonKey: 'invented-public-test-key', key, id: createHash('sha256').update(key).digest('hex') }
const started = Date.UTC(2026, 9, 2, 20)
const contexts = []
const errors = []
let sequence = 0
const store = new Map()
const history = []
const held = new Map()
const stamp = () => new Date(started + ++sequence).toISOString()
const id = 'disposable-open-editor-fixture'
const S0 = 'Disposable sync fixture\nOriginal text'
const S1 = 'Disposable sync fixture\nPhone edit one'
const S2 = 'Disposable sync fixture\nPhone edit two'
function reset() {
  store.clear()
  store.set(`pages|${id}`, { id, vault: vault.id, notebook: 'field-notes', body: S0, created: started - 1000, updated: started - 1000, pinned: false, deleted: null, server_at: stamp() })
}
async function device(label, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })
  contexts.push(context)
  await context.addInitScript(({ vault }) => {
    localStorage.setItem('field-notes.vault', JSON.stringify(vault))
    localStorage.setItem('field-notes.weather.off', '1')
  }, { vault })
  await context.route('**/*', async (route, request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(base).origin) return route.continue()
    if (url.origin !== vault.url || !url.pathname.startsWith('/rest/v1/')) return route.abort()
    assert.equal(request.headers()['x-vault-key'], key)
    const table = url.pathname.split('/').pop()
    if (request.method() === 'POST') {
      for (const row of request.postDataJSON()) {
        assert.equal(row.vault, vault.id)
        store.set(`${table}|${row.id}`, { ...row, server_at: stamp() })
        if (table === 'pages') history.push({ label, id: row.id, body: row.body, updated: row.updated })
      }
      return route.fulfill({ status: 201, body: '' })
    }
    const gate = table === 'pages' && held.get(label)
    if (gate) {
      gate.requested = true
      await gate.promise
    }
    const cursor = (url.searchParams.get('server_at') ?? '').replace(/^gte\./, '')
    const rows = [...store.entries()].filter(([k]) => k.startsWith(`${table}|`)).map(([, r]) => r)
      .filter(r => r.server_at >= cursor).sort((a, b) => a.server_at.localeCompare(b.server_at))
      .slice(0, Number(url.searchParams.get('limit') ?? 200))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(`${label}: ${e.message}`))
  await page.clock.install({ time: new Date(started) })
  await page.goto(`${base}/n/field-notes`)
  await waitFor(async () => (await stored({ page }))?.body === S0, 'initial fixture sync')
  await page.goto(`${base}/p/${id}`)
  await page.clock.fastForward(1000)
  await page.waitForFunction(() => document.querySelector('.cm-content'))
  assert.equal(await page.locator('.cm-content').innerText(), S0)
  return { label, page, context }
}
async function rows(d) {
  return d.page.evaluate(async () => {
    const open = indexedDB.open('field-notes')
    const db = await new Promise(resolve => { open.onsuccess = () => resolve(open.result) })
    const get = db.transaction('pages', 'readonly').objectStore('pages').getAll()
    const result = await new Promise(resolve => { get.onsuccess = () => resolve(get.result) })
    db.close()
    return result
  })
}
async function stored(d) { return (await rows(d)).find(r => r.id === id) }
async function waitFor(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 30)) }
  assert.fail(`Timed out: ${label}`)
}
async function write(d, text) {
  await d.page.locator('.cm-content').fill(text)
  await d.page.clock.fastForward(300)
  await waitFor(async () => (await stored(d)).body === text, 'local save')
  await d.page.clock.fastForward(4000)
  await waitFor(() => store.get(`pages|${id}`).body === text, 'mock upload')
}
async function pullInPlace(d) {
  await d.page.clock.fastForward(5 * 60 * 1000 + 1000)
}
function holdPull(label) {
  let release
  const promise = new Promise(resolve => { release = resolve })
  const gate = { promise, release, requested: false }
  held.set(label, gate)
  return gate
}
try {
  reset()
  const a = await device('Mac')
  const b = await device('Phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await write(b, S1)
  await a.page.locator('.cm-content').press('ControlOrMeta+Home')
  await a.page.locator('.cm-content').press('ArrowRight')
  await a.page.locator('.cm-content').press('Shift+ArrowRight')
  const selected = await a.page.evaluate(() => window.getSelection().toString())
  await pullInPlace(a)
  await waitFor(async () => (await stored(a)).body === S1, 'Mac receives phone text')
  const visible = await a.page.locator('.cm-content').innerText()
  assert.equal(visible, baseline ? S0 : S1)
  assert.equal(await a.page.evaluate(() => window.getSelection().toString()), selected, 'remote update preserves an unaffected selection')
  const before = await stored(a)
  await a.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await a.page.clock.fastForward(4500)
  await waitFor(async () => (await stored(a)).body === (baseline ? S0 : S1), 'idle flush result')
  await waitFor(() => store.get(`pages|${id}`).body === (baseline ? S0 : S1), 'mirror after idle flush')
  const after = await stored(a)
  assert.equal((await rows(a)).filter(r => r.body.includes('#conflict')).length, 0)
  if (!baseline) assert.equal(after.updated, before.updated, 'idle visibility must not author an edit')
  console.log(JSON.stringify({ case: 'idle-open-editor', visibleAfterPull: visible, localBeforeFlush: before.body, localAfterFlush: after.body, mirrorAfterFlush: store.get(`pages|${id}`).body, copyCount: 0 }))
  console.log(`${baseline ? 'REPRODUCED' : 'PASS'}: idle open editor ${baseline ? 'replaces received phone text without a copy' : 'receives remote text without writing it back'}`)
  if (!baseline) await a.page.screenshot({ path: '../evidence/open-editor-desktop.png', fullPage: true })
  await a.context.close(); await b.context.close()

  reset()
  const c = await device('Mac-overlap')
  const d = await device('Phone-overlap', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await write(d, S1)
  await pullInPlace(c)
  await waitFor(async () => (await stored(c)).body === S1, 'Mac receives first phone edit')
  await write(d, S2)
  await c.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await c.page.clock.fastForward(4500)
  await waitFor(async () => (await rows(c)).some(r => r.body.includes(baseline ? '#conflict' : 'Phone edit two')), 'overlap reconciliation')
  const all = await rows(c)
  const copies = all.filter(r => r.body.includes('#conflict'))
  assert.equal(copies.length, baseline ? 1 : 0)
  assert.equal((await stored(c)).body, baseline ? S0 : S2)
  if (baseline) assert.ok(copies[0].body.includes('Phone edit two'), 'remote writing preserved by conflict mechanism')
  console.log(JSON.stringify({ case: 'idle-overlap', original: (await stored(c)).body, copies: copies.map(r => r.body) }))
  console.log(`${baseline ? 'REPRODUCED' : 'PASS'}: second phone edit ${baseline ? 'creates a conflict although Mac never typed' : 'does not conflict with an idle Mac editor'}`)
  await c.context.close(); await d.context.close()

  if (!baseline) {
    for (const saveFirst of [false, true]) {
      reset()
      const label = saveFirst ? 'saved-draft' : 'pending-draft'
      const mac = await device(label)
      const phone = await device(`${label}-phone`, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
      await write(phone, S1)
      const gate = holdPull(label)
      await pullInPlace(mac)
      await waitFor(() => gate.requested, 'held in-place pull')
      await mac.page.clock.pauseAt(new Date(await mac.page.evaluate(() => Date.now()) + 1000))
      const draft = 'Disposable sync fixture\nMac draft while pull waits'
      await mac.page.locator('.cm-content').fill(draft)
      if (saveFirst) {
        await mac.page.clock.fastForward(300)
        await waitFor(async () => (await stored(mac)).body === draft, 'draft saved before pull returns')
      }
      held.delete(label); gate.release()
      if (!saveFirst) await waitFor(async () => (await stored(mac)).body === S1, 'remote arrives during local debounce')
      await mac.page.clock.fastForward(300)
      await waitFor(async () => (await stored(mac)).body === draft, 'guarded local draft save')
      await mac.page.clock.resume()
      await mac.page.clock.fastForward(4500)
      await waitFor(() => [...store.values()].some(r => r.body?.includes('#conflict') && r.body.includes('Phone edit one')), 'conflicting writing preserved and uploaded')
      const pages = (await rows(mac)).filter(r => !r.deleted)
      assert.equal(pages.filter(r => r.body.includes('#conflict')).length, 1)
      assert.ok(pages.some(r => r.body === draft))
      assert.ok(pages.some(r => r.body.includes('Phone edit one')))
      assert.equal(await mac.page.locator('.cm-content').innerText(), draft)
      const count = pages.length
      await mac.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await mac.page.clock.fastForward(4500)
      assert.equal((await rows(mac)).filter(r => !r.deleted).length, count, 'repeat flush does not duplicate the same conflict')
      console.log(`PASS: ${label} survives an overlapping pull and keeps remote writing exactly once`)
      await mac.context.close(); await phone.context.close()
    }

    for (const [label, options] of [
      ['touch-phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
      ['touch-tablet', { viewport: { width: 1024, height: 1366 }, hasTouch: true }],
    ]) {
      reset()
      const receiver = await device(label, options)
      const writer = await device(`${label}-writer`)
      await write(writer, S1)
      await pullInPlace(receiver)
      await waitFor(async () => (await receiver.page.locator('.cm-content').innerText()) === S1, 'touch editor receives text')
      const before = await stored(receiver)
      await receiver.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await receiver.page.clock.fastForward(4500)
      assert.equal((await stored(receiver)).updated, before.updated)
      assert.equal((await rows(receiver)).filter(r => r.body.includes('#conflict')).length, 0)
      console.log(`PASS: ${label} accepts remote text and idle resume does not save a stale body`)
      await receiver.page.screenshot({ path: `../evidence/open-editor-${label}.png`, fullPage: true })
      await receiver.context.close(); await writer.context.close()
    }

    reset()
    const undoMac = await device('undo-mac')
    const undoPhone = await device('undo-phone')
    await undoMac.page.locator('.cm-content').press('ControlOrMeta+End')
    await undoMac.page.keyboard.insertText(' — Mac addition')
    await undoMac.page.clock.fastForward(300)
    await waitFor(async () => (await stored(undoMac)).body === S0 + ' — Mac addition', 'local undoable edit saved')
    await undoMac.page.clock.fastForward(4500)
    await waitFor(() => store.get(`pages|${id}`).body === S0 + ' — Mac addition', 'local edit uploaded')
    await pullInPlace(undoPhone)
    await waitFor(async () => (await stored(undoPhone)).body === S0 + ' — Mac addition', 'phone receives local edit')
    await write(undoPhone, S0 + ' — Mac addition\nPhone append')
    await pullInPlace(undoMac)
    await waitFor(async () => (await undoMac.page.locator('.cm-content').innerText()).includes('Phone append'), 'remote append displayed')
    await undoMac.page.locator('.cm-content').press('ControlOrMeta+z')
    await undoMac.page.clock.fastForward(300)
    await waitFor(async () => (await stored(undoMac)).body === S0 + '\nPhone append', 'undo retains the remote append')
    await undoMac.page.locator('.cm-content').press('ControlOrMeta+Shift+z')
    await undoMac.page.clock.fastForward(300)
    await waitFor(async () => (await stored(undoMac)).body === S0 + ' — Mac addition\nPhone append', 'redo retains remote append')
    assert.equal((await rows(undoMac)).filter(r => r.body.includes('#conflict')).length, 0)
    console.log('PASS: received changes preserve local undo/redo without undoing the remote writing')
    await undoMac.context.close(); await undoPhone.context.close()

    reset()
    const composingMac = await device('composition-mac')
    const composingPhone = await device('composition-phone')
    await write(composingPhone, S1)
    const compositionGate = holdPull('composition-mac')
    await pullInPlace(composingMac)
    await waitFor(() => compositionGate.requested, 'composition pull held')
    await composingMac.page.clock.pauseAt(new Date(await composingMac.page.evaluate(() => Date.now()) + 1000))
    await composingMac.page.locator('.cm-content').press('ControlOrMeta+End')
    const session = await composingMac.context.newCDPSession(composingMac.page)
    await session.send('Input.imeSetComposition', { text: '漢字', selectionStart: 2, selectionEnd: 2 })
    await composingMac.page.clock.fastForward(60)
    held.delete('composition-mac'); compositionGate.release()
    await waitFor(async () => (await stored(composingMac)).body === S1, 'remote arrives during composition')
    assert.ok((await composingMac.page.locator('.cm-content').innerText()).includes('漢字'), 'active composition retained')
    await session.send('Input.insertText', { text: '漢字' })
    await composingMac.page.clock.fastForward(400)
    await composingMac.page.clock.resume()
    await waitFor(async () => (await stored(composingMac)).body === S0 + '漢字', 'composed local writing saved')
    const composedRows = await rows(composingMac)
    assert.equal(composedRows.filter(r => r.body.includes('#conflict')).length, 1)
    assert.ok(composedRows.some(r => r.body.includes('Phone edit one')))
    console.log('PASS: active Chromium composition survives remote arrival and both authored versions are kept')
    await composingMac.context.close(); await composingPhone.context.close()

    reset()
    const deletedMac = await device('deleted-original')
    const deletionGate = holdPull('deleted-original')
    const old = store.get(`pages|${id}`)
    store.set(`pages|${id}`, { ...old, deleted: started + 100, updated: started + 100, server_at: stamp() })
    await pullInPlace(deletedMac)
    await waitFor(() => deletionGate.requested, 'tombstone pull held')
    await deletedMac.page.clock.pauseAt(new Date(await deletedMac.page.evaluate(() => Date.now()) + 1000))
    const recovered = 'Disposable sync fixture\nDraft during remote deletion'
    await deletedMac.page.locator('.cm-content').fill(recovered)
    held.delete('deleted-original'); deletionGate.release()
    await waitFor(async () => (await stored(deletedMac)).deleted, 'original remains a tombstone')
    await deletedMac.page.clock.fastForward(300)
    await deletedMac.page.clock.resume()
    await waitFor(() => !deletedMac.page.url().endsWith('/' + id), 'draft opens as a recovered copy')
    const recoveredPages = (await rows(deletedMac)).filter(r => !r.deleted && r.body.includes('Draft during remote deletion'))
    assert.equal(recoveredPages.length, 1)
    assert.ok((await stored(deletedMac)).deleted)
    assert.ok(recoveredPages[0].body.startsWith('> Conflicting copy'))
    console.log('PASS: pending draft survives remote deletion as one copy without resurrecting the original')
    await deletedMac.context.close()
  }
  assert.deepEqual(errors, [])
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser.close()
}
