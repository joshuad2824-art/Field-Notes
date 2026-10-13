import { db, changed } from './db'
import { JOURNAL_NOTEBOOK, type Page } from './model'
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
export async function closeQuickNote(draft: QuickDraft) {
  if (!draft.notebook || !draft.body.trim()) {
    await saveQuickNote(draft)
    return
  }
  await db.transaction('rw', db.pages, db.notebooks, db.meta, async () => {
    const book = await db.notebooks.get(draft.notebook)
    if (!book || book.deleted || book.id === JOURNAL_NOTEBOOK)
      throw new Error('Choose an available notebook before filing.')
    const page: Page = {
      id: draft.id,
      body: draft.body,
      notebook: book.id,
      created: draft.created,
      updated: Date.now(),
      pinned: 0,
    }
    await db.pages.add(page)
    await db.meta.delete(key)
  })
  changed()
}
