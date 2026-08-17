import {
  allMarks,
  changed,
  db,
  dropUntouchedSeed,
  forgetMarks,
  getCursor,
  mark,
  markFor,
  markMany,
  setCursor,
  subscribe,
} from '../lib/db'
import { isoDay, readableDay } from '../lib/format'
import { imageIdsIn, isBlank, type Notebook, type Page } from '../lib/model'
import { reloadNotebooks } from '../lib/notebooks'
import { conflictBody, decide, samePage } from './reconcile'
import { setStatus } from './status'
import { EPOCH, SyncError, supabaseTransport, type Transport } from './transport'
import { getVault, setVault } from './vault'
import type { Vault } from './pairing'
import {
  imageToRow,
  notebookToRow,
  pageToRow,
  rowToImage,
  rowToNotebook,
  rowToPage,
  sameNotebook,
  type ImageRow,
  type NotebookRow,
  type PageRow,
  type Row,
  type TableName,
} from './wire'

/* The background worker, and nothing above it knows it runs.

   Its whole contract is the third sentence of the architecture note: nothing
   is ever lost, including when sync breaks — and sync will break. So every
   step here is arranged so that failing at it leaves the device exactly as it
   was. Pulled rows are applied to IndexedDB before anything is pushed; a row
   is only recorded as agreed after the write that agreed it came back; and a
   conflict costs a duplicate page rather than a paragraph. */

const BATCH = 200
/* A whole batch stamped in one instant would stall a cursor that can only
   move to the last row's stamp. Widening the window is the way past it, and
   this is where widening stops and we say so instead. */
const WIDEST = 6400
const DEBOUNCE = 3000
const EVERY = 5 * 60 * 1000

let transport: Transport | null = null
let unsubscribe: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let heartbeat: ReturnType<typeof setInterval> | undefined
let running = false
let queued = false
/* Applying pulled rows fires the store's change bus, which is what tells the
   screens to re-read. It must not also be what tells us to sync again. */
let applying = false

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/* ── the pull ──────────────────────────────────────────────────────────── */

interface Pulled {
  rows: Row[]
  cursor: string
}

async function pull(table: TableName): Promise<Pulled> {
  const t = transport
  if (!t) throw new SyncError('Not paired.')
  const start = (await getCursor(table)) ?? EPOCH
  /* Keyed by id and not accumulated, because widening the window re-reads rows
     we already hold and the later copy is the one that counts. */
  const seen = new Map<string, Row>()
  let cursor = start
  let limit = BATCH

  for (;;) {
    const rows = await t.since(table, cursor, limit)
    for (const row of rows) seen.set(row.id, row)
    const last = rows.length ? (rows[rows.length - 1].server_at ?? cursor) : cursor

    if (rows.length < limit) {
      cursor = last
      break
    }
    if (last === cursor) {
      if (limit >= WIDEST) {
        throw new SyncError(`More than ${WIDEST} rows share one instant on ${table}.`)
      }
      limit *= 2
      continue
    }
    cursor = last
  }

  return { rows: [...seen.values()], cursor }
}

/* ── pages ─────────────────────────────────────────────────────────────── */

async function syncPages(vault: Vault): Promise<void> {
  const t = transport!
  const { rows, cursor } = await pull('pages')

  const marks = await allMarks()
  const locals = new Map((await db.pages.toArray()).map((p) => [p.id, p]))
  const remotes = new Map(rows.map((r) => [r.id, rowToPage(r as PageRow)]))

  const apply: Page[] = []
  const push: Page[] = []
  const copies: Page[] = []
  const stamp = readableDay(isoDay())

  /* The losing half of a conflict, kept as its own page in the same notebook.
     A tombstone loses nothing worth keeping, and neither does a blank. */
  const keepCopy = (loser: Page) => {
    if (loser.deleted || isBlank(loser.body)) return
    copies.push({
      id: uuid(),
      notebook: loser.notebook,
      body: conflictBody(loser.body, stamp),
      created: loser.created,
      updated: Date.now(),
      pinned: 0,
      ...(loser.entryDate ? { entryDate: loser.entryDate } : {}),
      ...(loser.pen ? { pen: loser.pen } : {}),
      ...(loser.stock ? { stock: loser.stock } : {}),
    })
  }

  for (const id of new Set([...locals.keys(), ...remotes.keys()])) {
    const local = locals.get(id)
    const remote = remotes.get(id)
    const verdict = decide({
      hasLocal: !!local,
      hasRemote: !!remote,
      localUpdated: local?.updated ?? 0,
      remoteUpdated: remote?.updated ?? 0,
      marked: marks.get(markFor.page(id)),
      identical: !!local && !!remote && samePage(local, remote),
      remoteDeleted: !!remote?.deleted,
    })

    if (verdict === 'apply' && remote) apply.push(remote)
    else if (verdict === 'push' && local) push.push(local)
    else if (verdict === 'keep-local' && local && remote) {
      push.push(local)
      keepCopy(remote)
    } else if (verdict === 'keep-remote' && local && remote) {
      apply.push(remote)
      keepCopy(local)
    }
  }

  /* Local first, always. If the push below never happens the device has still
     gained everything the mirror had, and nothing it had is gone. */
  if (apply.length || copies.length) {
    applying = true
    try {
      await db.pages.bulkPut([...apply, ...copies])
      await markMany(apply.map((p) => ({ id: markFor.page(p.id), at: p.updated })))
    } finally {
      applying = false
    }
    changed()
  }
  await setCursor('pages', cursor)

  const outgoing = [...push, ...copies]
  for (const batch of chunk(outgoing, 100)) {
    await t.put(
      'pages',
      batch.map((p) => pageToRow(p, vault.id)),
    )
    await markMany(batch.map((p) => ({ id: markFor.page(p.id), at: p.updated })))
  }
}

/* ── notebooks ─────────────────────────────────────────────────────────── */

/* No conflict copies here. A notebook is a name, a colour and a position; the
   newer one winning costs a rename at worst, and there is no writing inside it
   to lose — its pages are their own rows and reconcile on their own. */
async function syncNotebooks(vault: Vault): Promise<void> {
  const t = transport!
  const { rows, cursor } = await pull('notebooks')

  const marks = await allMarks()
  const locals = new Map((await db.notebooks.toArray()).map((n) => [n.id, n]))
  const remotes = new Map(rows.map((r) => [r.id, rowToNotebook(r as NotebookRow)]))

  const apply: Notebook[] = []
  const push: Notebook[] = []

  for (const id of new Set([...locals.keys(), ...remotes.keys()])) {
    const local = locals.get(id)
    const remote = remotes.get(id)
    const verdict = decide({
      hasLocal: !!local,
      hasRemote: !!remote,
      localUpdated: local?.updated ?? 0,
      remoteUpdated: remote?.updated ?? 0,
      marked: marks.get(markFor.notebook(id)),
      identical: !!local && !!remote && sameNotebook(local, remote),
      remoteDeleted: !!remote?.deleted,
    })

    if (verdict === 'apply' || verdict === 'keep-remote') {
      if (remote) apply.push(remote)
    } else if (verdict === 'push' || verdict === 'keep-local') {
      if (local) push.push(local)
    }
  }

  if (apply.length) {
    applying = true
    try {
      await db.notebooks.bulkPut(apply)
      await markMany(apply.map((n) => ({ id: markFor.notebook(n.id), at: n.updated ?? 0 })))
    } finally {
      applying = false
    }
    await reloadNotebooks()
  }
  await setCursor('notebooks', cursor)

  if (push.length) {
    await t.put(
      'notebooks',
      push.map((n) => notebookToRow(n, vault.id)),
    )
    await markMany(push.map((n) => ({ id: markFor.notebook(n.id), at: n.updated ?? 0 })))
  }
}

/* ── pictures ──────────────────────────────────────────────────────────── */

/* A picture is written once and never edited, so there is no last-write-wins
   here and no cursor either. What goes up is whatever this device has that it
   hasn't sent; what comes down is only what a page on this device actually
   mentions. That second half is also how a pruned picture stays pruned — the
   page that stopped referring to it syncs first, so nobody ever asks for the
   bytes again.

   They go last and one at a time. A photograph is a few million bytes and the
   text is the archive; if the connection is only good enough for one of them,
   it should be the writing. */
async function syncImages(vault: Vault): Promise<void> {
  const t = transport!
  const local = await db.images.toArray()
  const marks = await allMarks()

  for (const image of local) {
    if (marks.has(markFor.image(image.id))) continue
    await t.put('images', [await imageToRow(image, vault.id)])
    await mark(markFor.image(image.id), image.added)
  }

  const have = new Set(local.map((i) => i.id))
  const wanted = new Set<string>()
  for (const page of await db.pages.toArray()) {
    if (page.deleted) continue
    for (const id of imageIdsIn(page.body)) if (!have.has(id)) wanted.add(id)
  }
  if (!wanted.size) return

  for (const batch of chunk([...wanted], 4)) {
    const rows = (await t.byId('images', batch)) as ImageRow[]
    if (!rows.length) continue
    applying = true
    try {
      await db.images.bulkPut(rows.map(rowToImage))
      await markMany(rows.map((r) => ({ id: markFor.image(r.id), at: Number(r.added) })))
    } finally {
      applying = false
    }
    changed()
  }
}

/* ── the run ───────────────────────────────────────────────────────────── */

export async function syncNow(): Promise<void> {
  const vault = getVault()
  if (!vault) {
    setStatus({ state: 'off', error: null })
    return
  }
  if (running) {
    queued = true
    return
  }

  running = true
  transport = supabaseTransport(vault)
  setStatus({ state: 'syncing', error: null })

  try {
    await syncNotebooks(vault)
    await syncPages(vault)
    await syncImages(vault)
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null })
  } catch (error) {
    /* Unpairing mid-run pulls the transport out from under this. That isn't a
       failure to report — the device asked for it, and the status it wants is
       already set. */
    if (getVault()) {
      const failure = error instanceof SyncError ? error : null
      setStatus({
        state: failure?.offline ? 'offline' : 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  } finally {
    running = false
  }

  if (queued) {
    queued = false
    soon(DEBOUNCE)
  }
}

function soon(delay: number): void {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

function onChanged(): void {
  if (applying) return
  if (running) {
    queued = true
    return
  }
  soon(DEBOUNCE)
}

function onVisible(): void {
  if (document.visibilityState === 'visible') soon(400)
}

function onOnline(): void {
  soon(800)
}

/* ── starting and stopping ─────────────────────────────────────────────── */

export function startSync(): void {
  stopSync()
  if (!getVault()) {
    setStatus({ state: 'off', error: null })
    return
  }
  setStatus({ state: 'idle', error: null })
  unsubscribe = subscribe(onChanged)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  heartbeat = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, EVERY)
  /* After the first paint, never before it. */
  soon(600)
}

export function stopSync(): void {
  unsubscribe?.()
  unsubscribe = null
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('online', onOnline)
  clearTimeout(timer)
  clearInterval(heartbeat)
  timer = undefined
  heartbeat = undefined
  transport = null
}

/* ── pairing ───────────────────────────────────────────────────────────── */

/* `joining` is the difference between the device that made the vault and every
   device after it. One of them is bringing writing to an empty mirror; the
   others are arriving at a full one, and their untouched first-run page has no
   business becoming everyone's second copy of it. */
export async function connect(vault: Vault, joining: boolean): Promise<void> {
  stopSync()
  await forgetMarks()
  if (joining) await dropUntouchedSeed()
  setVault(vault)
  startSync()
  clearTimeout(timer)
  await syncNow()
}

export async function disconnect(): Promise<void> {
  stopSync()
  setVault(null)
  await forgetMarks()
  setStatus({ state: 'off', lastSyncedAt: null, error: null })
  try {
    localStorage.removeItem('field-notes.sync.last')
  } catch {
    /* nothing here is worth failing over */
  }
}
