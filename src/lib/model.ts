/* A page is a markdown string plus a small envelope. That's the whole model,
   and it's deliberately boring, because boring survives. */

/* A notebook id is just a string now that notebooks are data. */
export type NotebookId = string
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
  pen?: Pen // unset means "follow the default"
  stock?: Stock // likewise
  deleted?: number // tombstone timestamp, never a hard delete
}

/* Pen and stock are per-page attributes with an app-wide default behind them.
   A page only stores a value once it has been given one deliberately, so
   changing the default moves every page that never disagreed with it. */
export function effectivePen(page: Pick<Page, 'pen'>, fallback: Pen): Pen {
  return page.pen ?? fallback
}

export function effectiveStock(page: Pick<Page, 'stock'>, fallback: Stock): Stock {
  return page.stock ?? fallback
}

export interface Notebook {
  id: NotebookId
  name: string
  color: string
  order: number
  /* Notebooks are rows on three devices now, so they need the same two fields
     a page has: something to compare when two devices disagree, and a
     tombstone rather than a hole. A notebook that was merely removed would be
     handed straight back by the next device to sync. */
  updated?: number
  deleted?: number
}

/* What the shelf is seeded with on first run. After that it's whatever is in
   the notebooks table. */
export const DEFAULT_NOTEBOOKS: Notebook[] = [
  /* Seeded at 0 rather than now: two devices that each stood these four up
     before ever pairing should meet with nothing to argue about. */
  { id: 'field-notes', name: 'Field Notes', color: '#082744', order: 0, updated: 0 },
  { id: 'workshop', name: 'The Workshop', color: '#3a342e', order: 1, updated: 0 },
  { id: 'hearth', name: 'The Hearth', color: '#530a28', order: 2, updated: 0 },
  { id: 'church', name: 'Church', color: '#123737', order: 3, updated: 0 },
]

/* Covers come from the palette, so a new notebook still looks like it belongs
   on the shelf. */
export const COVER_COLORS = [
  '#082744',
  '#3a342e',
  '#530a28',
  '#123737',
  '#24332a',
  '#1b261f',
]

export const DEFAULT_NOTEBOOK: NotebookId = 'field-notes'

/* Pages linger for thirty days after deletion so a bug can't take them. */
export const TOMBSTONE_DAYS = 30

/* ── pictures ──────────────────────────────────────────────────────────
   A picture on the page is still just markdown: an image node whose path is
   where the file will be on export, plus a placement qualifier. The bytes sit
   in Dexie beside the page; the export writes them to that exact path, so the
   link resolves in any other editor. */

/* Where a picture sits and which side the writing runs down. `margin` is the
   old name for `right` and is still read, so pages written before this keep
   working. */
export type Placement = 'left' | 'right' | 'full'

export const PLACEMENTS: Placement[] = ['left', 'right', 'full']

/* Percent of the measure. A margin plate defaults to 44, a full one to 100. */
export const SIZES = [25, 33, 44, 50, 60, 75, 100] as const

export function defaultSize(placement: Placement): number {
  return placement === 'full' ? 100 : 44
}

export function stepSize(current: number, direction: 1 | -1): number {
  const nearest = SIZES.reduce((best, size) =>
    Math.abs(size - current) < Math.abs(best - current) ? size : best,
  )
  const at = SIZES.indexOf(nearest)
  const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, at + direction))]
  return next
}

export interface PageImage {
  id: string
  page: string
  blob: Blob
  type: string
  ext: string
  /* True for an SVG or anything with real transparency — it gets no frame. */
  cutout?: boolean
  added: number
}

export const IMAGE_DIR = 'images'

export const IMAGE_RE =
  /!\[([^\]]*)\]\(images\/([\w-]+)\.(\w+)\)(?:\{(left|right|margin|full)(?:\s+(\d{1,3}))?\})?/g

export function readPlacement(raw: string | undefined): Placement {
  if (raw === 'full') return 'full'
  if (raw === 'left') return 'left'
  return 'right'
}

export function imageMarkdown(
  id: string,
  ext: string,
  caption: string,
  placement: Placement,
  size = defaultSize(placement),
): string {
  const qualifier =
    size === defaultSize(placement) ? placement : `${placement} ${Math.round(size)}`
  return `![${caption}](${IMAGE_DIR}/${id}.${ext}){${qualifier}}`
}

export function imageIdsIn(body: string): string[] {
  return [...body.matchAll(IMAGE_RE)].map((m) => m[2])
}

/* ── deriving things from the body ─────────────────────────────────────
   Title and tags are derived, never stored. The body is the single source
   of truth and there is no metadata to drift out of sync with it. */

/* ── indent ────────────────────────────────────────────────────────────
   Leading spaces, two to a level, which is what a nested markdown list already
   is — so it exports as real nesting rather than a private convention. Four
   levels is as far as it goes; past that the measure has nothing left to
   give. */

export const INDENT_UNIT = '  '
export const MAX_INDENT = 4

export function depthOf(text: string): number {
  const lead = text.match(/^ +/)?.[0].length ?? 0
  return Math.min(MAX_INDENT, Math.floor(lead / INDENT_UNIT.length))
}

const BLOCK_PREFIX = /^(#{1,3}\s+|>\s?|[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s)/

export function stripMarkers(line: string): string {
  return line
    /* The indent goes before the prefix does, or an indented list item keeps
       its dash in the title. */
    .replace(/^ +/, '')
    .replace(BLOCK_PREFIX, '')
    /* A picture reads as its caption, or as nothing. */
    .replace(/!\[([^\]]*)\]\([^)]*\)(?:\{[^}]*\})?/g, '$1')
    .replace(/==(?:\{\w+\})?([^=]+)==/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/* A table's rows are structure, not prose. They're skipped when a page is
   being read for a title, a snippet or a word count, so a page that opens
   with a table isn't called "| Item | Qty |". */
export function isTableLine(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

export function titleOf(body: string): string {
  for (const line of body.split('\n')) {
    if (isTableLine(line)) continue
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
    if (isTableLine(line)) continue
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

/* What's in a table's cells is writing and counts; its pipes, its dashes and
   its merge marks are structure and don't. */
const DELIMITER_ROW = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/

export function wordCount(body: string): number {
  const t = body
    .split('\n')
    .filter((line) => !DELIMITER_ROW.test(line))
    .map((line) => (isTableLine(line) ? line.replace(/\|/g, ' ').replace(/(^|\s)<(?=\s|$)/g, ' ') : line))
    .join('\n')
    .trim()
  return t ? t.split(/\s+/).length : 0
}

export function isBlank(body: string): boolean {
  return body.trim() === ''
}

/* The drag payload when a picture is moved from one place in the page to
   another. Its own type, so a picture dragged out of the page and a file
   dragged in don't get confused for each other. */
export const PICTURE_DRAG = 'application/x-field-notes-picture'
