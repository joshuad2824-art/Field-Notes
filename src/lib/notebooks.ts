import { useSyncExternalStore } from 'react'
import { db, changed, subscribe } from './db'
import { DEFAULT_NOTEBOOKS, JOURNAL_BOOK, JOURNAL_NOTEBOOK, type Notebook } from './model'

/* Notebooks used to be a constant. They're data now — any notebook can be
   added, coloured from the palette, and deleted — but they're still read
   synchronously everywhere a row needs a name or a dot, so the list is kept in
   a module cache that starts as the original four and hydrates from Dexie on
   boot. One level. Permanently.

   Two lists come off that cache, and the difference matters:

   `allNotebooks` is every live notebook, the reserved journal included. Export,
   import and any lookup by id want this one — a journal entry has to end up in
   a whole-shelf export, and a restored one has to find its way back by name
   rather than growing a sixth notebook.

   `shelfNotebooks` is the notebooks a person picks from: the rail's list, the
   manager, the move menu, the capture routes. The journal is assembled rather
   than written in and has its own place in the rail's foot, so it is not on
   that list.

   Both are held as arrays rather than computed on call, because
   `useSyncExternalStore` compares snapshots by identity and a filter that
   returns a fresh array every render never settles. */

let cache: Notebook[] = []
let shelf: Notebook[] = []
let hydrated = false

function hold(rows: Notebook[]): Notebook[] {
  cache = rows
  shelf = rows.filter((n) => n.id !== JOURNAL_NOTEBOOK)
  return cache
}

hold([...DEFAULT_NOTEBOOKS, JOURNAL_BOOK])

export function allNotebooks(): Notebook[] {
  return cache
}

export function shelfNotebooks(): Notebook[] {
  return shelf
}

/* Reserved: ordinary in the file, refused in the interface. */
export function isReserved(id: string): boolean {
  return id === JOURNAL_NOTEBOOK
}

export function journalBook(): Notebook {
  return notebookOf(JOURNAL_NOTEBOOK) ?? JOURNAL_BOOK
}

export function notebookOf(id: string): Notebook | undefined {
  return cache.find((n) => n.id === id)
}

/* Never returns undefined — a page whose notebook was deleted still has to
   render something. */
export function notebookForPage(id: string): Notebook {
  return notebookOf(id) ?? shelf[0] ?? { id, name: 'Notebook', color: '#082744', order: 0 }
}

export function firstNotebookId(): string {
  return shelf[0]?.id ?? cache[0]?.id ?? ''
}

/* Live ones only. A deleted notebook stays as a row so the deletion can cross
   a wire, but the shelf has no business showing it. */
function sort(rows: Notebook[]): Notebook[] {
  return rows
    .filter((n) => !n.deleted)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export async function loadNotebooks(): Promise<Notebook[]> {
  const rows = await db.notebooks.toArray()
  if (rows.length === 0) {
    const seed = [...DEFAULT_NOTEBOOKS, JOURNAL_BOOK]
    await db.notebooks.bulkPut(seed)
    hold(sort(seed))
  } else {
    /* The seed only ever ran on an empty table, so adding an entry to
       DEFAULT_NOTEBOOKS does nothing at all on a device that has already run —
       which is every device there is. The journal needs its own upsert, and it
       belongs here rather than in a Dexie version upgrade because it also has
       to reach a device that arrived at this schema through sync. Stamped 0,
       for the reason written beside the other four: two devices that each
       stood it up before pairing must meet with nothing to argue about. */
    if (!rows.some((n) => n.id === JOURNAL_NOTEBOOK)) {
      await db.notebooks.put(JOURNAL_BOOK)
      rows.push(JOURNAL_BOOK)
    }
    hold(sort(rows))
  }
  hydrated = true
  changed()
  return cache
}

/* Sync applies notebook rows straight to Dexie, so it needs a way to say "the
   table moved under you" without knowing how the cache is kept. */
export async function reloadNotebooks(): Promise<void> {
  hold(sort(await db.notebooks.toArray()))
  changed()
}

export function notebooksReady(): boolean {
  return hydrated
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `nb-${Math.random().toString(36).slice(2, 10)}`
}

export async function addNotebook(name: string, color: string): Promise<Notebook> {
  const trimmed = name.trim()
  const book: Notebook = {
    id: uuid(),
    name: trimmed,
    color,
    /* The journal sits at 900 so it can never be in anyone's way; the next
       ordinary notebook goes after the last ordinary one. */
    order: shelf.length ? Math.max(...shelf.map((n) => n.order)) + 1 : 0,
    updated: Date.now(),
  }
  await db.notebooks.put(book)
  hold(sort([...cache, book]))
  changed()
  return book
}

/* The three refusals the reserved notebook needs. They live here rather than
   in the manager because a guard in one screen is a guard until the next
   screen is written — and because a journal that could be deleted and then
   came back on the following boot would be a notebook that ignores you. */
export async function renameNotebook(id: string, name: string): Promise<void> {
  if (isReserved(id)) return
  const book = cache.find((n) => n.id === id)
  if (!book) return
  const next = { ...book, name: name.trim(), updated: Date.now() }
  await db.notebooks.put(next)
  hold(sort(cache.map((n) => (n.id === id ? next : n))))
  changed()
}

/* A colour is no longer chosen once at creation and fixed forever. Notebooks
   carry `updated`, so the new colour crosses the wire on the next sync with
   no schema change and no reconciler change. */
export async function recolorNotebook(id: string, color: string): Promise<void> {
  if (isReserved(id)) return
  const book = cache.find((n) => n.id === id)
  if (!book) return
  const next = { ...book, color, updated: Date.now() }
  await db.notebooks.put(next)
  hold(sort(cache.map((n) => (n.id === id ? next : n))))
  changed()
}

/* Deleting a notebook tombstones its pages rather than destroying them — the
   same thirty days a page gets on its own — and now tombstones the notebook
   too. A row that simply vanished would be handed straight back by the next
   device to sync, which had no way of telling "deleted" from "not yet seen". */
export async function deleteNotebook(id: string): Promise<number> {
  if (isReserved(id)) return 0
  const pages = await db.pages.where('notebook').equals(id).toArray()
  const now = Date.now()
  const doomed = pages.filter((p) => !p.deleted)
  if (doomed.length) {
    await db.pages.bulkPut(doomed.map((p) => ({ ...p, deleted: now, updated: now })))
  }
  const book = await db.notebooks.get(id)
  if (book) await db.notebooks.put({ ...book, deleted: now, updated: now })
  hold(cache.filter((n) => n.id !== id))
  changed()
  return doomed.length
}

/* The shelf, because that is what every screen listing notebooks is showing.
   Settings' export buttons want the other one. */
export function useNotebooks(): Notebook[] {
  return useSyncExternalStore(subscribe, shelfNotebooks, shelfNotebooks)
}

export function useAllNotebooks(): Notebook[] {
  return useSyncExternalStore(subscribe, allNotebooks, allNotebooks)
}
