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
    storeFields: ['id'],
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

export async function search(query: string, limit = 60): Promise<Hit[]> {
  const q = query.trim()
  if (!q) return []
  const idx = await ensureIndex()
  const results = idx.search(q).slice(0, limit)
  const pages = await db.pages.bulkGet(results.map((r) => r.id as string))

  const hits: Hit[] = []
  results.forEach((result, i) => {
    const page = pages[i]
    if (!page || page.deleted) return
    const terms = result.terms
    hits.push({ page, excerpt: excerptFor(page.body, terms), terms })
  })
  return hits
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
