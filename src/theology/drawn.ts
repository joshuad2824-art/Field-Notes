import type { StudyAnnotation } from './model'

// The mark drawn over any piece of text is the newest saved highlight covering
// it, ties broken by id. The renderer and the toolbar's Remove share this order,
// so what Remove would take is always what the eye sees.
export const drawnFirst = (a: StudyAnnotation, b: StudyAnnotation) => b.updated - a.updated || b.id.localeCompare(a.id)

// The one saved highlight drawn over every piece of [start, end) and covering all
// of it, or null: a range that crosses plain text, a second highlight, or an
// overlap drawn on top has no single highlight to remove.
export function drawnTarget(marks: StudyAnnotation[], start: number, end: number): string | null {
  const hits = marks.filter(a => a.start < end && a.end > start)
  if (!hits.length || end <= start) return null
  const edges = [...new Set([start, end, ...hits.flatMap(a => [a.start, a.end]).filter(n => n > start && n < end)])].sort((a, b) => a - b)
  let id: string | null = null
  for (let i = 0; i < edges.length - 1; i++) {
    const top = hits.filter(a => a.start <= edges[i] && a.end >= edges[i + 1]).sort(drawnFirst)[0]
    if (!top || (id !== null && top.id !== id)) return null
    id = top.id
  }
  const target = marks.find(a => a.id === id)
  return target && target.start <= start && target.end >= end ? target.id : null
}
