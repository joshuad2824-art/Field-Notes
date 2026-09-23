import { db, changed } from './db'
import type { SienaItem } from './model'

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
  const items = (await db.sienaItems.toArray()).filter((item) => !item.seenAt)
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
    const at = Math.max(Date.now(), item.updated + 1)
    await db.sienaItems.put({ ...item, completedAt: at, seenAt: Math.max(item.seenAt ?? 0, at), updated: at })
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
  const sorted = [...items].sort((a, b) => b.created - a.created)
  return {
    featured: sorted.find((item) => item.type === 'note'),
    reminders: sorted.filter((item) => item.type === 'reminder' && item.dueAt !== undefined &&
      item.dueAt < end && !item.completedAt),
    updates: sorted.filter((item) => item.type === 'task_update' && !item.seenAt).slice(0, 4),
    unseen: items.filter((item) => !item.seenAt).length,
  }
}
