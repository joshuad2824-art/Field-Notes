/* A page is a markdown string plus a small envelope. That's the whole model,
   and it's deliberately boring, because boring survives. */

export type NotebookId = 'field-notes' | 'workshop' | 'hearth' | 'church'
export type Pen = 'ink' | 'felt'
export type Stock = 'paper' | 'night'

export interface Page {
  id: string
  notebook: NotebookId
  body: string
  created: number
  updated: number
  pinned: 0 | 1 // indexed, so a number rather than a bool
  entryDate?: string // YYYY-MM-DD — the day this page is "about"
  pen: Pen
  stock: Stock
  deleted?: number // tombstone timestamp, never a hard delete
}

export interface Notebook {
  id: NotebookId
  name: string
  cover: 'navy' | 'driftwood' | 'oxblood' | 'forest'
}

/* One level. Permanently. */
export const NOTEBOOKS: Notebook[] = [
  { id: 'field-notes', name: 'Field Notes', cover: 'navy' },
  { id: 'workshop', name: 'The Workshop', cover: 'driftwood' },
  { id: 'hearth', name: 'The Hearth', cover: 'oxblood' },
  { id: 'church', name: 'Church', cover: 'forest' },
]

export const DEFAULT_NOTEBOOK: NotebookId = 'field-notes'

/* Pages linger for thirty days after deletion so a bug can't take them. */
export const TOMBSTONE_DAYS = 30

export function notebookOf(id: string): Notebook {
  return NOTEBOOKS.find((n) => n.id === id) ?? NOTEBOOKS[0]
}

/* ── deriving things from the body ─────────────────────────────────────
   Title and tags are derived, never stored. The body is the single source
   of truth and there is no metadata to drift out of sync with it. */

const BLOCK_PREFIX = /^(#{1,3}\s+|>\s?|[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s)/

export function stripMarkers(line: string): string {
  return line
    .replace(BLOCK_PREFIX, '')
    .replace(/==(?:\{\w+\})?([^=]+)==/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

export function titleOf(body: string): string {
  for (const line of body.split('\n')) {
    const text = stripMarkers(line)
    if (text) return text.length > 90 ? text.slice(0, 89).trimEnd() + '…' : text
  }
  return 'Untitled'
}

export function snippetOf(body: string): string {
  const lines = body.split('\n')
  let seenTitle = false
  const parts: string[] = []
  for (const line of lines) {
    const text = stripMarkers(line)
    if (!text) continue
    if (!seenTitle) {
      seenTitle = true
      continue
    }
    parts.push(text)
    if (parts.join(' ').length > 160) break
  }
  const s = parts.join(' ')
  return s.length > 160 ? s.slice(0, 159).trimEnd() + '…' : s
}

const TAG_RE = /(^|\s)#([A-Za-z][\w-]*)/g

export function tagsOf(body: string): string[] {
  const seen = new Map<string, string>()
  for (const m of body.matchAll(TAG_RE)) {
    const tag = m[2]
    const key = tag.toLowerCase()
    if (!seen.has(key)) seen.set(key, tag)
  }
  return [...seen.values()]
}

export function wordCount(body: string): number {
  const t = body.trim()
  return t ? t.split(/\s+/).length : 0
}

export function isBlank(body: string): boolean {
  return body.trim() === ''
}
