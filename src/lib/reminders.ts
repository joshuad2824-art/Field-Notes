import { db, changed } from './db'
import type { NotebookId, SienaItem } from './model'
import { ST_JOHN_NOTEBOOK } from './notebook-desk'

/* The Reminders room's verbs (November 2026). A reminder is still a Siena
   item of type `reminder` — the same row the St. John desk, the per-notebook
   Reminders page and Siena's own tools read — so nothing about how they sync
   or how Siena sees them changed. What is new is that one can now be edited
   and removed here, and both are said in fields the mirror already carries.

   A reminder's words and due time are taken from the mirror's copy whenever
   two copies are merged (siena-reconcile.ts): Siena's messages were written
   to be immutable. So an edit is not an overwrite — an overwrite would be
   quietly undone by the next sync. It is a replacement: a new reminder with
   the new words, and the old one closed. Closing is state, which has its own
   clock and merges properly.

   The four states, all in existing columns:
     open      no completedAt
     done      completedAt
     removed   completedAt + resolvedAt          (in the Archive, restorable)
     replaced  completedAt + resolvedAt + requiresAction === false
               (an edit's old copy; nowhere in the interface)
   requiresAction and resolvedAt meant nothing for a reminder before this. */

export type ReminderState = 'open' | 'done' | 'removed' | 'replaced'

export function reminderState(item: SienaItem): ReminderState {
  if (!item.completedAt) return 'open'
  if (!item.resolvedAt) return 'done'
  return item.requiresAction === false ? 'replaced' : 'removed'
}

/* Work reminders live on the St. John desk and nowhere else. */
export function isWorkReminder(item: SienaItem): boolean {
  return item.notebook === ST_JOHN_NOTEBOOK
}

export function personalReminders(items: SienaItem[]): SienaItem[] {
  return items.filter((item) => item.type === 'reminder' && !isWorkReminder(item))
}

const clockFor = (item: SienaItem) =>
  Math.max(Date.now(), item.updated + 1, (item.stateAt ?? 0) + 1, (item.completedAt ?? 0) + 1,
    (item.resolvedAt ?? 0) + 1, (item.retainedAt ?? 0) + 1)

export interface ReminderDraft {
  title: string
  dueAt: number
  notebook: NotebookId
  note?: string
}

function check(draft: ReminderDraft): { title: string; body: string } {
  const title = draft.title.trim()
  if (!title) throw new Error('Write the reminder first.')
  if (title.length > 240) throw new Error('Keep the reminder under 240 characters; put the rest in its note.')
  if (!Number.isFinite(draft.dueAt)) throw new Error('Give it a time.')
  const note = draft.note?.trim()
  return { title, body: note || title }
}

export async function addReminder(draft: ReminderDraft): Promise<SienaItem> {
  const { title, body } = check(draft)
  const at = Date.now()
  const item: SienaItem = {
    id: crypto.randomUUID(), type: 'reminder', title, body,
    notebook: draft.notebook, dueAt: draft.dueAt, created: at, updated: at,
  }
  await db.sienaItems.put(item)
  changed()
  return item
}

/* Returns the reminder as it now stands — the same row when only its
   notebook moved, a new one when its words or time changed. */
export async function editReminder(id: string, draft: ReminderDraft): Promise<SienaItem> {
  const { title, body } = check(draft)
  let result: SienaItem | undefined
  await db.transaction('rw', db.sienaItems, async () => {
    const old = await db.sienaItems.get(id)
    if (!old || old.type !== 'reminder') throw new Error('That reminder is no longer here.')
    if (reminderState(old) !== 'open') throw new Error('Reopen the reminder before editing it.')
    const oldBody = old.body.trim() === (old.title ?? '').trim() ? '' : old.body.trim()
    const sameWords = (old.title ?? old.body).trim() === title && oldBody === (draft.note?.trim() ?? '')
    const sameTime = old.dueAt === draft.dueAt
    const at = clockFor(old)
    if (sameWords && sameTime) {
      result = old.notebook === draft.notebook ? old : { ...old, notebook: draft.notebook, updated: at, stateAt: at }
      if (result !== old) await db.sienaItems.put(result)
      return
    }
    await db.sienaItems.put({
      ...old, completedAt: at, resolvedAt: at, requiresAction: false, stateAt: at, updated: at,
      seenAt: old.seenAt ?? at,
    })
    result = {
      id: crypto.randomUUID(), type: 'reminder', title, body,
      notebook: draft.notebook, dueAt: draft.dueAt,
      ...(old.sourceUrl ? { sourceUrl: old.sourceUrl } : {}),
      created: old.created, updated: at, seenAt: at,
    }
    await db.sienaItems.put(result)
  })
  changed()
  return result!
}

export async function removeReminder(id: string): Promise<void> {
  await db.transaction('rw', db.sienaItems, async () => {
    const item = await db.sienaItems.get(id)
    if (!item || item.type !== 'reminder' || reminderState(item) !== 'open') return
    const at = clockFor(item)
    await db.sienaItems.put({
      ...item, completedAt: at, resolvedAt: at, stateAt: at, updated: at,
      seenAt: Math.max(item.seenAt ?? 0, at),
    })
  })
  changed()
}

/* Back to open, from done or from removed. A replaced copy is never reopened:
   its replacement is the reminder. */
export async function reopenReminder(id: string): Promise<void> {
  await db.transaction('rw', db.sienaItems, async () => {
    const item = await db.sienaItems.get(id)
    if (!item || item.type !== 'reminder') return
    const state = reminderState(item)
    if (state === 'open' || state === 'replaced') return
    const at = clockFor(item)
    const { completedAt: _c, resolvedAt: _r, requiresAction: _a, ...rest } = item
    await db.sienaItems.put({ ...rest, stateAt: at, updated: at })
  })
  changed()
}
