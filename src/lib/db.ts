import Dexie, { type Table } from 'dexie'
import { dayOf } from './calendar'
import {
  DEFAULT_NOTEBOOK,
  DEFAULT_NOTEBOOKS,
  TOMBSTONE_DAYS,
  type Notebook,
  type NotebookId,
  type Page,
  type Pen,
  type PageImage,
  type Stock,
  isBlank,
  tagsOf,
} from './model'

/* IndexedDB is the primary store, not a cache. Nothing in this file waits on a
   network — sync reads and writes these same tables afterwards, from its own
   module, on its own schedule, and the editor never learns it happened. */

/* What this device and the mirror last agreed on, for one row. Kept in its own
   table rather than as a field on the page, so the page stays exactly the
   small envelope the architecture note describes and nothing sync-shaped can
   leak into an export. Ids are namespaced because a notebook's id is a word
   and a page's is a uuid. */
export interface SyncMark {
  id: string
  at: number
}

export const markFor = {
  page: (id: string) => `p:${id}`,
  notebook: (id: string) => `n:${id}`,
  image: (id: string) => `i:${id}`,
}

class FieldNotesDB extends Dexie {
  pages!: Table<Page, string>
  notebooks!: Table<Notebook, string>
  images!: Table<PageImage, string>
  synced!: Table<SyncMark, string>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('field-notes')
    this.version(1).stores({
      pages: 'id, notebook, updated, created, pinned, deleted, entryDate',
      meta: 'key',
    })

    /* v2: pen and stock became optional overrides with an app default behind
       them. Pages carrying the old baked-in defaults give them up, so the
       default actually governs them; anything deliberately set to felt or
       night keeps its override. */
    this.version(2)
      .stores({
        pages: 'id, notebook, updated, created, pinned, deleted, entryDate',
        meta: 'key',
      })
      .upgrade((tx) =>
        tx
          .table<Page>('pages')
          .toCollection()
          .modify((page) => {
            if (page.pen === 'ink') delete page.pen
            if (page.stock === 'paper') delete page.stock
          }),
      )

    /* v3: notebooks stop being a constant and become rows, and pictures get
       somewhere to live. The four that were hard-coded are seeded so nothing
       moves for anyone already writing. */
    this.version(3)
      .stores({
        pages: 'id, notebook, updated, created, pinned, deleted, entryDate',
        notebooks: 'id, order',
        images: 'id, page',
        meta: 'key',
      })
      .upgrade((tx) => tx.table<Notebook>('notebooks').bulkPut(DEFAULT_NOTEBOOKS))

    /* v4: Phase 2. A table for what each row was last agreed at, and notebooks
       grow the two fields that let them cross a wire. Existing notebooks are
       stamped 0 rather than now — two devices that each seeded the same four
       covers before ever pairing should meet with nothing to argue about. */
    this.version(4)
      .stores({
        pages: 'id, notebook, updated, created, pinned, deleted, entryDate',
        notebooks: 'id, order',
        images: 'id, page',
        synced: 'id',
        meta: 'key',
      })
      .upgrade((tx) =>
        tx
          .table<Notebook>('notebooks')
          .toCollection()
          .modify((book) => {
            book.updated ??= 0
          }),
      )
  }
}

export const db = new FieldNotesDB()

/* ── the change bus ────────────────────────────────────────────────────
   Every write bumps a counter; screens re-run their query. Cheaper than a
   subscription library and there is only one writer. */

let version = 0
const listeners = new Set<() => void>()

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function storeVersion(): number {
  return version
}

export function changed() {
  version++
  for (const fn of listeners) fn()
}

/* ── reads ─────────────────────────────────────────────────────────────── */

export async function getPage(id: string): Promise<Page | undefined> {
  return db.pages.get(id)
}

export async function livePages(notebook?: NotebookId): Promise<Page[]> {
  const rows = notebook
    ? await db.pages.where('notebook').equals(notebook).toArray()
    : await db.pages.toArray()
  return sortForShelf(rows.filter((p) => !p.deleted))
}

export async function deletedPages(): Promise<Page[]> {
  const rows = await db.pages.toArray()
  return rows.filter((p) => p.deleted).sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0))
}

export async function pagesWithTag(tag: string): Promise<Page[]> {
  const key = tag.toLowerCase()
  const rows = await db.pages.toArray()
  return sortForShelf(
    rows.filter((p) => !p.deleted && tagsOf(p.body).some((t) => t.toLowerCase() === key)),
  )
}

export async function allTags(): Promise<{ tag: string; count: number }[]> {
  const rows = await db.pages.toArray()
  const counts = new Map<string, { tag: string; count: number }>()
  for (const page of rows) {
    if (page.deleted) continue
    for (const tag of tagsOf(page.body)) {
      const key = tag.toLowerCase()
      const found = counts.get(key)
      if (found) found.count++
      else counts.set(key, { tag, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag))
}

/* The calendar's two reads. Both go through `dayOf`, so the rail's marks, the
   day view and the month view can't disagree about which day a page is on. */
export async function pagesOnDay(iso: string): Promise<Page[]> {
  const rows = await db.pages.toArray()
  return rows
    .filter((p) => !p.deleted && dayOf(p) === iso)
    .sort((a, b) => a.created - b.created)
}

export async function pagesInMonth(month: string): Promise<Page[]> {
  const rows = await db.pages.toArray()
  return rows
    .filter((p) => !p.deleted && dayOf(p).startsWith(month))
    .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.created - b.created)
}

export async function daysWritten(): Promise<Set<string>> {
  const rows = await db.pages.toArray()
  return new Set(rows.filter((p) => !p.deleted).map(dayOf))
}

export async function notebookCounts(): Promise<Record<string, number>> {
  const rows = await db.pages.toArray()
  const counts: Record<string, number> = {}
  for (const page of rows) {
    if (page.deleted) continue
    counts[page.notebook] = (counts[page.notebook] ?? 0) + 1
  }
  return counts
}

/* Pinned first, then most recently touched. */
function sortForShelf(rows: Page[]): Page[] {
  return rows.sort((a, b) => b.pinned - a.pinned || b.updated - a.updated)
}

/* ── writes ────────────────────────────────────────────────────────────── */

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export async function createPage(
  notebook: NotebookId = DEFAULT_NOTEBOOK,
  body = '',
): Promise<Page> {
  const now = Date.now()
  const page: Page = {
    id: uuid(),
    notebook,
    body,
    created: now,
    updated: now,
    pinned: 0,
  }
  await db.pages.put(page)
  changed()
  return page
}

export async function saveBody(id: string, body: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page || page.body === body) return
  await db.pages.put({ ...page, body, updated: Date.now() })
  changed()
}

export async function patchPage(id: string, patch: Partial<Page>): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  await db.pages.put({ ...page, ...patch, updated: Date.now() })
  changed()
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  await patchPage(id, { pinned: pinned ? 1 : 0 })
}

export async function setPen(id: string, pen: Pen): Promise<void> {
  await patchPage(id, { pen })
}

export async function setStock(id: string, stock: Stock): Promise<void> {
  await patchPage(id, { stock })
}

/* Hand the page back to whatever the app default is. */
export async function clearOverrides(id: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  const { pen: _pen, stock: _stock, ...rest } = page
  await db.pages.put({ ...rest, updated: Date.now() } as Page)
  changed()
}

export async function moveTo(id: string, notebook: NotebookId): Promise<void> {
  await patchPage(id, { notebook })
}

/* Tombstone. A blank page leaves nothing behind and goes straight out.
   Deleting and restoring both move `updated`, because that field is what tells
   another device something happened here — a tombstone laid down without
   touching it would look, from the mirror's side, exactly like a page nobody
   had opened. */
export async function deletePage(id: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  const now = Date.now()
  if (isBlank(page.body)) await db.pages.delete(id)
  else await db.pages.put({ ...page, deleted: now, updated: now })
  changed()
}

export async function restorePage(id: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  const { deleted: _deleted, ...rest } = page
  await db.pages.put({ ...rest, updated: Date.now() } as Page)
  changed()
}

/* Gone for good on this device. The mirror keeps its tombstone, which is what
   stops a device that was switched off for a month walking the page back in. */
export async function purgePage(id: string): Promise<void> {
  await db.pages.delete(id)
  await db.synced.delete(markFor.page(id))
  changed()
}

/* ── what the mirror and this device last agreed on ────────────────────── */

export async function allMarks(): Promise<Map<string, number>> {
  const rows = await db.synced.toArray()
  return new Map(rows.map((row) => [row.id, row.at]))
}

export async function mark(id: string, at: number): Promise<void> {
  await db.synced.put({ id, at })
}

export async function markMany(marks: SyncMark[]): Promise<void> {
  if (marks.length) await db.synced.bulkPut(marks)
}

/* Unpairing. The writing is untouched; only the memory of having agreed about
   it goes, so pairing again reconciles from nothing rather than from a record
   of a vault this device no longer belongs to. */
export async function forgetMarks(): Promise<void> {
  await db.synced.clear()
  await db.meta.where('key').startsWith('cursor.').delete()
}

export async function getCursor(table: string): Promise<string | null> {
  const row = await db.meta.get(`cursor.${table}`)
  return typeof row?.value === 'string' ? row.value : null
}

export async function setCursor(table: string, cursor: string): Promise<void> {
  await db.meta.put({ key: `cursor.${table}`, value: cursor })
}

/* ── housekeeping ──────────────────────────────────────────────────────── */

export async function purgeExpiredTombstones(): Promise<number> {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86400_000
  const rows = await db.pages.toArray()
  const gone = rows.filter((p) => p.deleted && p.deleted < cutoff).map((p) => p.id)
  if (gone.length) {
    await db.pages.bulkDelete(gone)
    /* The mirror keeps its tombstone; this device keeps nothing, including the
       record of having agreed about it. */
    await db.synced.bulkDelete(gone.map(markFor.page))
    changed()
  }
  return gone.length
}

/* Ask the browser not to evict this under storage pressure. Installed PWAs are
   generally granted it; nothing depends on the answer. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted?.()) return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

const SEED = `# The first morning

The whole question this page has to answer is a small one: do I want to write here?

* Whether the **dots** sit under the lines or fight them
* Whether Spectral at seventeen holds a =={brass}long thought==
- A dashed line, for when a dot is too round

- [ ] Write three real paragraphs
- [x] Open the page

> Certainly work is not always required of a man. There is such a thing as a sacred idleness, the cultivation of which is now fearfully neglected.

Type over all of this. #field-notes`

/* First run only: one page, so the shelf isn't a set of empty rooms. */
export async function seedIfEmpty(): Promise<void> {
  const seeded = await db.meta.get('seeded')
  if (seeded) return
  const count = await db.pages.count()
  if (count === 0) {
    const page = await createPage('field-notes', SEED)
    await db.meta.put({ key: 'seed', value: page.id })
  }
  await db.meta.put({ key: 'seeded', value: Date.now() })
}

/* A device that has just been paired into an existing vault would otherwise
   push its own untouched first-run page across, and the other two would each
   grow a second copy of a page whose only job was to be typed over. If it has
   been written in at all it stays — `updated` moving is the test. */
export async function dropUntouchedSeed(): Promise<boolean> {
  const row = await db.meta.get('seed')
  const id = typeof row?.value === 'string' ? row.value : null
  if (!id) return false
  const page = await db.pages.get(id)
  await db.meta.delete('seed')
  if (!page || page.body !== SEED || page.updated !== page.created) return false
  await db.pages.delete(id)
  changed()
  return true
}
