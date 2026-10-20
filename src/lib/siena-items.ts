import { db, changed } from './db'
import type { SienaItem } from './model'
import { activeSienaItems } from './siena-archive'

const editAt = (item: SienaItem) => Math.max(Date.now(), item.updated + 1,
  (item.stateAt ?? 0) + 1, (item.completedAt ?? 0) + 1,
  (item.resolvedAt ?? 0) + 1, (item.retainedAt ?? 0) + 1)

export async function setSienaDisposition(id: string, expectedUpdated: number, action: 'resolve' | 'reopen' | 'restore' | 'release'): Promise<void> {
  await db.transaction('rw', db.sienaItems, async () => {
    const item = await db.sienaItems.get(id)
    if (!item || item.updated !== expectedUpdated) throw new Error('This item changed. Try again with its latest version.')
    const at = editAt(item)
    const next = { ...item, updated: at, stateAt: at }
    if (action === 'restore') {
      if (item.type === 'reminder') delete next.completedAt
      else next.retainedAt = at
    } else {
      if (item.type === 'reminder') throw new Error('Use reminder completion for this item.')
      if (action === 'resolve') { next.resolvedAt = at; delete next.retainedAt }
      if (action === 'reopen') { delete next.resolvedAt; next.requiresAction = true }
      if (action === 'release') delete next.retainedAt
    }
    await db.sienaItems.put(next)
  })
  changed()
}

export async function fileSienaItem(id: string, notebook: string | undefined, expectedUpdated: number): Promise<void> {
  await db.transaction('rw', db.sienaItems, db.notebooks, async () => {
    const item = await db.sienaItems.get(id)
    if (!item || item.updated !== expectedUpdated) throw new Error('This message changed. Try again with its latest version.')
    if (item.type === 'reminder') throw new Error('Reminders stay with their notebook.')
    if (notebook) {
      const book = await db.notebooks.get(notebook)
      if (!book || book.deleted) throw new Error('That notebook is no longer available.')
    }
    if (item.notebook === notebook) return
    const at = editAt(item)
    await db.sienaItems.put({ ...item, notebook, updated: at, stateAt: at })
  })
  changed()
}

export async function allSienaItems(): Promise<SienaItem[]> {
  return (await db.sienaItems.toArray()).sort((a, b) => b.created - a.created)
}

export async function markSienaItemSeen(id: string): Promise<void> {
  const item = await db.sienaItems.get(id)
  if (!item || item.seenAt) return
  const at = Math.max(Date.now(), item.updated + 1)
  await db.sienaItems.put({ ...item, seenAt: at, updated: at })
  changed()
}

export async function markAllSienaItemsSeen(): Promise<void> {
  const items = activeSienaItems(await db.sienaItems.toArray()).filter((item) => !item.seenAt)
  if (!items.length) return
  const at = Date.now()
  await db.sienaItems.bulkPut(items.map((item) => ({
    ...item,
    seenAt: Math.max(at, item.updated + 1),
    updated: Math.max(at, item.updated + 1),
  })))
  changed()
}

export async function completeReminder(id: string): Promise<void> {
  let completed = false
  await db.transaction('rw', db.sienaItems, async () => {
    const item = await db.sienaItems.get(id)
    if (!item || item.type !== 'reminder' || item.completedAt) return
    const at = editAt(item)
    await db.sienaItems.put({ ...item, completedAt: at, seenAt: Math.max(item.seenAt ?? 0, at), updated: at, stateAt: at })
    completed = true
  })
  if (completed) changed()
}

export async function remindersForNotebook(notebook: string): Promise<SienaItem[]> {
  return (await db.sienaItems.where('notebook').equals(notebook).toArray())
    .filter((item) => item.type === 'reminder')
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0) || a.created - b.created)
}

export async function createReminder(notebook: string, title: string, dueAt: number, pageId: string): Promise<SienaItem> {
  const at = Date.now()
  const item: SienaItem = {
    id: crypto.randomUUID(), type: 'reminder', title: title.trim(), body: title.trim(),
    notebook, dueAt, sourceUrl: `/p/${pageId}`, created: at, updated: at,
  }
  await db.sienaItems.put(item)
  changed()
  return item
}

export interface SienaSections {
  featured?: SienaItem
  reminders: SienaItem[]
  updates: SienaItem[]
  unseen: number
}

/* Active reminders stay visible through their due day and afterward until
   completed. Reading one does not take it off the desk. */
export function sienaSections(items: SienaItem[], today = new Date()): SienaSections {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()
  const active = activeSienaItems(items, today.getTime())
  const sorted = [...active].sort((a, b) => b.created - a.created)
  return {
    featured: sorted.find((item) => item.type === 'note'),
    reminders: sorted.filter((item) => item.type === 'reminder' && item.dueAt !== undefined &&
      item.dueAt < end && !item.completedAt),
    updates: sorted.filter((item) => item.type === 'task_update' && !item.seenAt).slice(0, 4),
    unseen: active.filter((item) => !item.seenAt).length,
  }
}
