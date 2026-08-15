import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_NOTEBOOK,
  TOMBSTONE_DAYS,
  type NotebookId,
  type Page,
  type Pen,
  type Stock,
  isBlank,
  tagsOf,
} from './model'

/* IndexedDB is the primary store, not a cache. Nothing in this file waits on a
   network, because there isn't one yet and the editor must never learn there
   could be. */

class FieldNotesDB extends Dexie {
  pages!: Table<Page, string>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('field-notes')
    this.version(1).stores({
      pages: 'id, notebook, updated, created, pinned, deleted, entryDate',
      meta: 'key',
    })
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

function changed() {
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
  return rows
    .filter((p) => p.deleted)
    .sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0))
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
    pen: 'ink',
    stock: 'paper',
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

export async function moveTo(id: string, notebook: NotebookId): Promise<void> {
  await patchPage(id, { notebook })
}

/* Tombstone. A blank page leaves nothing behind and goes straight out. */
export async function deletePage(id: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  if (isBlank(page.body)) await db.pages.delete(id)
  else await db.pages.put({ ...page, deleted: Date.now() })
  changed()
}

export async function restorePage(id: string): Promise<void> {
  const page = await db.pages.get(id)
  if (!page) return
  const { deleted: _deleted, ...rest } = page
  await db.pages.put(rest as Page)
  changed()
}

export async function purgePage(id: string): Promise<void> {
  await db.pages.delete(id)
  changed()
}

/* ── housekeeping ──────────────────────────────────────────────────────── */

export async function purgeExpiredTombstones(): Promise<number> {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86400_000
  const rows = await db.pages.toArray()
  const gone = rows.filter((p) => p.deleted && p.deleted < cutoff).map((p) => p.id)
  if (gone.length) {
    await db.pages.bulkDelete(gone)
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
  if (count === 0) await createPage('field-notes', SEED)
  await db.meta.put({ key: 'seeded', value: Date.now() })
}
