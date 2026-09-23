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

export interface SienaSections {
  featured?: SienaItem
  reminders: SienaItem[]
  updates: SienaItem[]
  unseen: number
}

/* A reminder from an earlier day stays visible until it is acknowledged.
   Today's reminders stay on the desk even after acknowledgment. */
export function sienaSections(items: SienaItem[], today = new Date()): SienaSections {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()
  const sorted = [...items].sort((a, b) => b.created - a.created)
  return {
    featured: sorted.find((item) => item.type === 'note'),
    reminders: sorted.filter((item) => item.type === 'reminder' && item.dueAt !== undefined &&
      item.dueAt < end && (item.dueAt >= start || !item.seenAt)),
    updates: sorted.filter((item) => item.type === 'task_update' && !item.seenAt).slice(0, 4),
    unseen: items.filter((item) => !item.seenAt).length,
  }
}
