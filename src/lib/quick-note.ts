import { db, changed } from './db'
import { JOURNAL_NOTEBOOK, QUICK_NOTES_NOTEBOOK, type Page } from './model'
export interface QuickDraft {
  id: string
  body: string
  notebook: string
  created: number
}
const key = 'quick-note.draft'
export async function readQuickNote(): Promise<QuickDraft> {
  return db.transaction('rw', db.meta, async () => {
    const saved = (await db.meta.get(key))?.value as QuickDraft | undefined
    if (saved) return saved
    const draft = { id: crypto.randomUUID(), body: '', notebook: '', created: Date.now() }
    await db.meta.put({ key, value: draft })
    return draft
  })
}
export async function saveQuickNote(draft: QuickDraft) {
  await db.meta.put({ key, value: draft })
}
/* Closing files the note. A notebook picked for it is where it goes; no pick
   means Quick Notes, which syncs and searches like any notebook — so nothing
   written here is ever left on the one device that wrote it. An empty note
   files nothing and leaves nothing behind, so the next one starts fresh. */
export async function closeQuickNote(draft: QuickDraft) {
  if (!draft.body.trim()) {
    await db.meta.delete(key)
    return
  }
  await db.transaction('rw', db.pages, db.notebooks, db.meta, async () => {
    const wanted = draft.notebook ? await db.notebooks.get(draft.notebook) : undefined
    const usable = wanted && !wanted.deleted && wanted.id !== JOURNAL_NOTEBOOK
    if (draft.notebook && !usable) throw new Error('Choose an available notebook before filing.')
    const page: Page = {
      id: draft.id,
      body: draft.body,
      notebook: usable && wanted ? wanted.id : QUICK_NOTES_NOTEBOOK,
      created: draft.created,
      updated: Date.now(),
      pinned: 0,
    }
    /* put, not add: a draft whose id already reached the store (two tabs, or
       a close that was interrupted after the write) files once, not twice. */
    await db.pages.put(page)
    await db.meta.delete(key)
  })
  changed()
}

/* Older builds kept an unfiled quick note on the device that wrote it. Once,
   on boot, any such leftover is filed into Quick Notes so it syncs. */
export async function fileLeftoverQuickNote(): Promise<boolean> {
  const saved = (await db.meta.get(key))?.value as QuickDraft | undefined
  if (!saved || !saved.body.trim() || saved.notebook) return false
  await closeQuickNote(saved)
  return true
}
