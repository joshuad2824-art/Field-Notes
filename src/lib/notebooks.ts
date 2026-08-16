import { useSyncExternalStore } from 'react'
import { db, changed, subscribe } from './db'
import { DEFAULT_NOTEBOOKS, type Notebook } from './model'

/* Notebooks used to be a constant. They're data now — any notebook can be
   added, coloured from the palette, and deleted — but they're still read
   synchronously everywhere a row needs a name or a dot, so the list is kept in
   a module cache that starts as the original four and hydrates from Dexie on
   boot. One level. Permanently. */

let cache: Notebook[] = DEFAULT_NOTEBOOKS
let hydrated = false

export function allNotebooks(): Notebook[] {
  return cache
}

export function notebookOf(id: string): Notebook | undefined {
  return cache.find((n) => n.id === id)
}

/* Never returns undefined — a page whose notebook was deleted still has to
   render something. */
export function notebookForPage(id: string): Notebook {
  return notebookOf(id) ?? cache[0] ?? { id, name: 'Notebook', color: '#082744', order: 0 }
}

export function firstNotebookId(): string {
  return cache[0]?.id ?? ''
}

function sort(rows: Notebook[]): Notebook[] {
  return [...rows].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export async function loadNotebooks(): Promise<Notebook[]> {
  const rows = await db.notebooks.toArray()
  if (rows.length === 0) {
    await db.notebooks.bulkPut(DEFAULT_NOTEBOOKS)
    cache = DEFAULT_NOTEBOOKS
  } else {
    cache = sort(rows)
  }
  hydrated = true
  changed()
  return cache
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
    order: cache.length ? Math.max(...cache.map((n) => n.order)) + 1 : 0,
  }
  await db.notebooks.put(book)
  cache = sort([...cache, book])
  changed()
  return book
}

export async function renameNotebook(id: string, name: string): Promise<void> {
  const book = cache.find((n) => n.id === id)
  if (!book) return
  const next = { ...book, name: name.trim() }
  await db.notebooks.put(next)
  cache = sort(cache.map((n) => (n.id === id ? next : n)))
  changed()
}

/* Deleting a notebook tombstones its pages rather than destroying them — the
   same thirty days a page gets on its own. */
export async function deleteNotebook(id: string): Promise<number> {
  const pages = await db.pages.where('notebook').equals(id).toArray()
  const now = Date.now()
  const doomed = pages.filter((p) => !p.deleted)
  if (doomed.length) {
    await db.pages.bulkPut(doomed.map((p) => ({ ...p, deleted: now })))
  }
  await db.notebooks.delete(id)
  cache = cache.filter((n) => n.id !== id)
  changed()
  return doomed.length
}

export function useNotebooks(): Notebook[] {
  return useSyncExternalStore(subscribe, allNotebooks, allNotebooks)
}
