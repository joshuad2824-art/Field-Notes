import MiniSearch from 'minisearch'
import { db, storeVersion } from './db'
import { type Page, stripMarkers, tagsOf, titleOf } from './model'

/* Search is entirely on-device and never touches a network — there is no
   privacy question to answer and no index to pay for. */

interface Doc {
  id: string
  title: string
  text: string
  tags: string
  notebook: string
}

let index: MiniSearch<Doc> | null = null
let builtAt = -1

function plain(body: string): string {
  return body.split('\n').map(stripMarkers).join(' ')
}

function toDoc(page: Page): Doc {
  return {
    id: page.id,
    title: titleOf(page.body),
    text: plain(page.body),
    tags: tagsOf(page.body).join(' '),
    notebook: page.notebook,
  }
}

async function ensureIndex(): Promise<MiniSearch<Doc>> {
  const version = storeVersion()
  if (index && builtAt === version) return index

  const pages = (await db.pages.toArray()).filter((p) => !p.deleted)
  const next = new MiniSearch<Doc>({
    fields: ['title', 'text', 'tags'],
    storeFields: ['id', 'notebook'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, tags: 2 },
    },
  })
  next.addAll(pages.map(toDoc))
  index = next
  builtAt = version
  return next
}

export interface Hit {
  page: Page
  excerpt: string
  terms: string[]
}

export interface Found {
  hits: Hit[]
  /* Every page that matched, not just the ones returned. */
  total: number
}

/* November 2026. Two things were wrong here, both found in the daily-use
   review. The notebook filter was applied by the screen *after* the top 60
   had been kept across every notebook, so Church showed 13 of 368 matching
   pages — so the filter goes into the index's own search, before anything is
   cut. And words were joined with OR, so a second word widened the results;
   they are joined with AND now, falling back to OR only when every word
   together finds nothing. */
export async function search(query: string, options: { notebook?: string; limit?: number } = {}): Promise<Found> {
  const q = query.trim()
  if (!q) return { hits: [], total: 0 }
  const idx = await ensureIndex()
  const filter = options.notebook
    ? (result: { [key: string]: unknown }) => result.notebook === options.notebook
    : undefined
  let results = idx.search(q, { combineWith: 'AND', filter })
  if (!results.length && /\s/.test(q)) results = idx.search(q, { combineWith: 'OR', filter })
  const kept = results.slice(0, options.limit ?? 200)
  const pages = await db.pages.bulkGet(kept.map((r) => r.id as string))

  const hits: Hit[] = []
  kept.forEach((result, i) => {
    const page = pages[i]
    if (!page || page.deleted) return
    const terms = result.terms
    hits.push({ page, excerpt: excerptFor(page.body, terms), terms })
  })
  return { hits, total: results.length }
}

/* What a person typed, as the words the other two kinds of result are matched
   on: every word has to be there, in any order. */
export function matchesWords(text: string, query: string): boolean {
  const hay = text.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word))
}

/* A window of plain text around the first match, so the result shows the
   sentence rather than the top of the page. */
function excerptFor(body: string, terms: string[]): string {
  const text = plain(body)
  const lower = text.toLowerCase()
  let at = -1
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase())
    if (found >= 0 && (at < 0 || found < at)) at = found
  }
  if (at < 0) return text.slice(0, 160)
  const start = Math.max(0, at - 60)
  const end = Math.min(text.length, at + 120)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}
