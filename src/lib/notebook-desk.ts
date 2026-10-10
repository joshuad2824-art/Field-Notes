import type { SienaItem } from './model'

// Existing notebook identity, verified in Joshua's archive. Renames retain the desk.
export const ST_JOHN_NOTEBOOK = 'd97288df-10bc-451f-8903-82d4e0c74873'

// Legacy reference pages may contain access information. Don't promote those
// excerpts onto a glanceable dashboard; the original page remains unchanged.
export function hasAccessDetails(body: string): boolean {
  return /\b(?:passwords?|passcodes?|credentials?|activation[\s-]+code|access[\s-]+code|usernames?|login[\s-]+id|temporary[\s-]+code|pin)\b/i.test(body)
}

export function notebookDeskItems(items: SienaItem[], notebook: string, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const scoped = items.filter(item => item.notebook === notebook)
  const active = scoped.filter(item => item.type === 'reminder' && !item.completedAt)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.created - b.created)
  return {
    active,
    due: active.filter(item => item.dueAt !== undefined && item.dueAt < end),
    upcoming: active.filter(item => item.dueAt === undefined || item.dueAt >= end),
    completed: scoped.filter(item => item.type === 'reminder' && item.completedAt).sort((a, b) => b.completedAt! - a.completedAt!),
    briefs: scoped.filter(item => item.type !== 'reminder').sort((a, b) => b.created - a.created),
  }
}
