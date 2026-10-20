import type { SienaItem } from './model'

export const SIENA_RETENTION_MS = 3 * 24 * 60 * 60 * 1000

export function needsResolution(item: SienaItem): boolean {
  return item.type !== 'reminder' && item.requiresAction !== false && !item.resolvedAt
}

/* Archive is a view of the original rows, never a deletion or a moved copy.
   Unknown action status is deliberately conservative. Seen is not resolved. */
export function isSienaArchived(item: SienaItem, now = Date.now()): boolean {
  if (item.type === 'reminder') return Boolean(item.completedAt)
  return !item.retainedAt && now - item.created >= SIENA_RETENTION_MS && !needsResolution(item)
}

export function activeSienaItems(items: SienaItem[], now = Date.now()): SienaItem[] {
  return items.filter(item => !isSienaArchived(item, now))
}
