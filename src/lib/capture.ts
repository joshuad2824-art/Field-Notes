import { dayOf } from './calendar'
import { createPage, db, saveBody } from './db'
import { isoDay } from './format'
import { allNotebooks, firstNotebookId, loadNotebooks, notebooksReady } from './notebooks'
import { getSettings } from './settings'

/* The capture path. Two routes that land a live caret — `/new` and `/today` —
   because the fastest capture used to be icon, shell, list, new page, type,
   and every phase of the research says that path is the one that decides
   whether a notes app survives its incumbent. A URL is the one entry point
   everything can reach: a bookmark, a dock icon, an iOS Shortcut on the
   Action Button.

   Both are ordinary local writes. Nothing here knows a network exists. */

const time = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' })

/* A cold hit on /new races the boot sequence, and creating a page in a
   notebook that hasn't hydrated yet would file it by guesswork. */
async function ready(): Promise<void> {
  if (!notebooksReady()) await loadNotebooks()
}

function homeNotebook(): string {
  const remembered = getSettings().notebook
  return allNotebooks().some((b) => b.id === remembered) ? remembered : firstNotebookId()
}

/* `/new/church` should work however the notebook is said — by id or by name,
   case blind — and a word the shelf doesn't know falls back to the remembered
   notebook rather than failing a capture over an address. */
function resolveNotebook(slug: string | undefined): string {
  if (slug) {
    const wanted = slug.trim().toLowerCase()
    const book =
      allNotebooks().find((b) => b.id.toLowerCase() === wanted) ??
      allNotebooks().find((b) => b.name.trim().toLowerCase() === wanted)
    if (book) return book.id
  }
  return homeNotebook()
}

/* One capture per intent. React's dev StrictMode mounts everything twice and
   a Shortcut can be double-tapped; either would file two pages for one
   thought. Within a second, the same ask gets the same page. */
let pending: { key: string; promise: Promise<string>; at: number } | null = null

function once(key: string, make: () => Promise<string>): Promise<string> {
  if (pending && pending.key === key && Date.now() - pending.at < 1000) return pending.promise
  const promise = make()
  pending = { key, promise, at: Date.now() }
  return promise
}

export function captureNew(slug?: string): Promise<string> {
  return once(`new:${slug ?? ''}`, async () => {
    await ready()
    const page = await createPage(resolveNotebook(slug))
    return page.id
  })
}

/* Append to today: the path where a fleeting thought never has to be judged
   worthy of its own page. Today's page — the one `dayOf` puts on this
   square, most recently touched if the day has several — grows a timestamped
   line at its foot; an empty day starts one. Decision 1 taken to its
   conclusion: no new page type, no new field, nothing added to the envelope. */
export function captureToday(): Promise<string> {
  return once('today', async () => {
    await ready()
    const today = isoDay()
    const rows = await db.pages.toArray()
    const standing = rows
      .filter((p) => !p.deleted && dayOf(p) === today)
      .sort((a, b) => b.updated - a.updated)[0]
    const stamp = `${time.format(new Date())} — `

    if (!standing) {
      const page = await createPage(homeNotebook(), stamp)
      return page.id
    }
    const body = standing.body.replace(/\n+$/, '')
    await saveBody(standing.id, body ? `${body}\n\n${stamp}` : stamp)
    return standing.id
  })
}

/* The screen that opens next should put the caret after the stamp, not at the
   top of a page being appended to. Said once, with a short shelf life rather
   than a hand-off, so a stale ask can't grab the caret on an ordinary visit
   later — and so StrictMode reading it twice reads the same answer. */
let caretAtEnd: { id: string; at: number } | null = null

export function wantCaretAtEnd(id: string): void {
  caretAtEnd = { id, at: Date.now() }
}

export function caretAtEndFor(id: string): boolean {
  return !!caretAtEnd && caretAtEnd.id === id && Date.now() - caretAtEnd.at < 3000
}
