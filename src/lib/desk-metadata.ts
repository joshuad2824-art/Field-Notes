import { db, changed } from './db'
import { tagsOf, type Page } from './model'

export type DeskKind = 'project' | 'plan' | 'equipment'
export const deskFields: Record<DeskKind, string[]> = {
  project: ['Project', 'Status', 'Owner', 'Where we left off', 'Next step', 'Artifact'],
  plan: ['Project', 'Version'], equipment: ['Brand', 'Model'],
}
const marker = { project: 'project', plan: 'project-plan', equipment: 'owned' }
export function deskBody(base: string, kind: DeskKind, values: Record<string, string>, marked = true): string {
  const lines = base.split('\n')
  let fence = ''
  const editable = lines.map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/)
    if (match) { fence = fence ? '' : match[1][0]; return false }
    return !fence
  })
  const added: string[] = []
  for (const label of deskFields[kind]) {
    const value = (values[label] || '').trim()
    if (/[\r\n]/.test(value)) throw new Error('Keep each detail on one line.')
    const at = lines.findIndex((line, i) => editable[i] && line.toLowerCase().startsWith(`${label.toLowerCase()}:`))
    if (at >= 0) lines[at] = value ? `${label}: ${value}` : ''
    else if (value) added.push(`${label}: ${value}`)
  }
  const tag = marker[kind]
  if (!marked) {
    for (let i = 0; i < lines.length; i++) if (editable[i]) lines[i] = lines[i].replace(new RegExp(`(^|\\s)#${tag}(?=[^\\w-]|$)`, 'gi'), '$1')
  } else if (!tagsOf(lines.filter((_, i) => editable[i]).join('\n')).some((t) => t.toLowerCase() === tag)) added.unshift(`#${tag}`)
  const original = lines.join('\n')
  return added.length ? `${original}${original.endsWith('\n\n') ? '' : original.endsWith('\n') ? '\n' : '\n\n'}${added.join('\n')}` : original
}
export async function saveDeskPage(base: Page | undefined, body: string, notebook: string): Promise<string | null> {
  let wrote = false
  const id = await db.transaction('rw', db.pages, async () => {
    if (base) {
      const current = await db.pages.get(base.id)
      if (!current || current.deleted || current.updated !== base.updated || current.body !== base.body) return null
      if (body !== current.body) { await db.pages.put({ ...current, body, updated: Math.max(Date.now(), current.updated + 1) }); wrote = true }
      return base.id
    }
    const now = Date.now(), id = crypto.randomUUID()
    await db.pages.put({ id, notebook, body, created: now, updated: now, pinned: 0 }); wrote = true
    return id
  })
  if (wrote) changed()
  return id
}
