import type { SienaItem } from '../lib/model.ts'

/* Seen is monotonic. Completion, resolution, retention and filing are
   reversible, so they share a separate edit clock rather than inheriting the
   timestamp of an unrelated read on an offline device. Older clients' actual
   completion timestamps still count as state edits. */
function stateClock(item: SienaItem): number {
  return Math.max(item.stateAt ?? 0, item.completedAt ?? 0, item.resolvedAt ?? 0, item.retainedAt ?? 0, item.created)
}
const stateKey = (item: SienaItem) => JSON.stringify([
  item.notebook ?? '', item.completedAt ?? 0, item.requiresAction ?? null,
  item.resolvedAt ?? 0, item.retainedAt ?? 0,
])

export function mergeSienaItems(local: SienaItem, remote: SienaItem): SienaItem {
  const a = stateClock(local), b = stateClock(remote)
  // A deterministic tie prevents equal-clock offline edits from oscillating.
  const state = a > b || (a === b && stateKey(local) > stateKey(remote)) ? local : remote
  const result: SienaItem = { ...remote }
  for (const key of ['notebook', 'completedAt', 'requiresAction', 'resolvedAt', 'retainedAt', 'stateAt'] as const) {
    delete result[key]
  }
  Object.assign(result, {
    ...(state.notebook ? { notebook: state.notebook } : {}),
    ...(state.completedAt ? { completedAt: state.completedAt } : {}),
    ...(typeof state.requiresAction === 'boolean' ? { requiresAction: state.requiresAction } : {}),
    ...(state.resolvedAt ? { resolvedAt: state.resolvedAt } : {}),
    ...(state.retainedAt ? { retainedAt: state.retainedAt } : {}),
    ...(state.stateAt ? { stateAt: state.stateAt } : {}),
  })
  const seenAt = Math.max(local.seenAt ?? 0, remote.seenAt ?? 0)
  if (seenAt) result.seenAt = seenAt
  result.updated = Math.max(local.updated, remote.updated, seenAt, a, b)
  return result
}
