import { tagsOf, titleOf, type Page } from './model'

// Explicit marks in existing pages, rather than another mutable project store.
// Free-text labels remain in the source page and travel with existing sync.
export function field(body: string, label: string): string {
  const line = metadataText(body).split('\n').find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))
  return line?.slice(label.length + 1).trim() ?? ''
}
function metadataText(body: string) {
  let fenced = false
  return body.split('\n').filter((line) => { if (/^\s*(?:`{3,}|~{3,})/.test(line)) { fenced = !fenced; return false }; return !fenced }).join('\n')
}
function marked(page: Page, tag: string) { return !page.deleted && !page.purpose && tagsOf(metadataText(page.body)).some((value) => value.toLowerCase() === tag) }
function revisionOrder(a: Page, b: Page) {
  const left = field(a.body, 'Version').match(/^v?(\d+(?:\.\d+)*)$/i)
  const right = field(b.body, 'Version').match(/^v?(\d+(?:\.\d+)*)$/i)
  if (left && right) {
    const l = left[1].split('.').map(Number), r = right[1].split('.').map(Number)
    for (let i = 0; i < Math.max(l.length, r.length); i++) { const order = (r[i] || 0) - (l[i] || 0); if (order) return order }
  }
  return b.updated - a.updated || a.id.localeCompare(b.id)
}
export function projectDesk(pages: Page[]) {
  const projects = new Map<string, Page>()
  const plans = new Map<string, Page[]>()
  for (const page of [...pages].sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id))) {
    if (marked(page, 'project') && field(page.body, 'Status').toLowerCase() === 'active') {
      const key = (field(page.body, 'Project') || titleOf(page.body)).toLowerCase()
      if (!projects.has(key)) projects.set(key, page)
    }
    if (marked(page, 'project-plan')) {
      const key = (field(page.body, 'Project') || titleOf(page.body)).toLowerCase()
      const revisions = plans.get(key) ?? []
      revisions.push(page); plans.set(key, revisions)
    }
  }
  return { active: [...projects.values()].slice(0, 3), plans: [...plans.values()].map((revisions) => revisions.sort(revisionOrder)), owned: pages.filter((page) => marked(page, 'owned')).sort((a, b) => titleOf(a.body).localeCompare(titleOf(b.body))) }
}
