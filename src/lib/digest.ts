import { dayOf } from './calendar'
import { isoDay, longDay, weekOf, weekRange } from './format'
import { IMAGE_RE, JOURNAL_NOTEBOOK, type Page, tagsOf, titleOf } from './model'

/* What a week reads as. The journal's step one, and all of it that can be
   thought about without a database.

   No Dexie, no fetch and no clock in here — the same rule `sync/reconcile.ts`
   follows and for the same reason: it is the part that is easy to get subtly
   wrong and it should be provable on node with nothing around it. The pages
   are handed in, the notebook names are handed in, and the moment in time is
   an argument. `journal.ts` is the thin layer that reads the one and writes
   the other.

   Two rules it inherits rather than invents. `weekOf` is the app's one idea of
   a week — Sunday-first, already matching `WEEKDAY_LETTERS` and the month
   grid — and there is not a second one here. And the entry it describes is an
   ordinary page: nothing is added to the envelope, which is the same move
   `captureToday` made and the reason export, import, sync and search have to
   learn nothing at all. */

/* The Sunday a week is named by, which is also the entry's `entryDate` — so it
   sits at the head of the week it covers when a month is read top to bottom. */
export function weekStart(ts: number = Date.now()): string {
  return isoDay(weekOf(ts)[0].getTime())
}

/* Last week, which is the one you actually want on a Sunday morning: the week
   just finished rather than the one three hours old. */
export function lastWeekAt(ts: number = Date.now()): number {
  return weekOf(ts)[0].getTime() - 86400_000
}

/* A page copied into the digest loses its pictures and keeps their captions.
   The bytes live in Dexie keyed to the page they were pasted into and the
   export writes them under that page's own notebook, so a link carried across
   would resolve to nothing in the journal's folder. The writing survives; the
   picture stays where it was put. */
function withoutPictures(body: string): string {
  return body.replace(IMAGE_RE, (_whole: string, caption: string | undefined) => caption ?? '')
}

/* Where a notebook's name comes from. Handed in rather than looked up, because
   the lookup lives behind Dexie and this file does not. */
export type NameOf = (notebook: string) => string

/* Headings inside the digest start at `##`, because the week's range is the
   page's own `#` and a page's title becomes a `###` under its day. A body
   copied in may carry headings of its own at any level; they are left exactly
   as they were written rather than shifted down, because rewriting somebody's
   markdown to fit a container is how a copy stops being a copy. */
function section(day: Date, pages: Page[], nameOf: NameOf): string {
  const parts = [`## ${longDay(day)}`]
  for (const page of pages) {
    parts.push(`### ${titleOf(page.body)}`)
    parts.push(`*${nameOf(page.notebook)}*`)
    const body = withoutPictures(page.body).trim()
    if (body) parts.push(body)
  }
  return parts.join('\n\n')
}

export interface Digest {
  /* The Sunday, which is both the entry's `entryDate` and its identity. */
  week: string
  body: string
  /* How many pages went into it, for the button that made it to say. */
  pages: number
}

export function digestOf(ts: number, all: Page[], nameOf: NameOf): Digest {
  const days = weekOf(ts)
  const within = new Set(days.map((d) => isoDay(d.getTime())))
  /* Live pages, and never the journal's own: an entry that gathered last
     week's entry would grow by a week every time it was collected. */
  const gathered = all
    .filter((p) => !p.deleted && p.notebook !== JOURNAL_NOTEBOOK && within.has(dayOf(p)))
    .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.created - b.created)

  const parts = [`# ${weekRange(days)}`]
  for (const day of days) {
    const iso = isoDay(day.getTime())
    const onDay = gathered.filter((p) => dayOf(p) === iso)
    if (onDay.length) parts.push(section(day, onDay, nameOf))
  }

  /* The tags of the week, said once at the foot. They are already inside the
     bodies above — gathering them is a convenience and not a second source —
     and the consequence worth naming is that the entry therefore turns up
     under every tag the week used. That is what a page containing the week is,
     and it is the price of full bodies rather than excerpts. */
  const tags = [...new Set(gathered.flatMap((p) => tagsOf(p.body)))]
  if (tags.length) parts.push(tags.map((t) => `#${t}`).join(' '))

  /* Never empty. A week nothing was written in still gets an entry, because
     the button has to do something visible when it is pressed and "nothing
     happened" is itself a true thing to have recorded. */
  if (gathered.length === 0) parts.push('Nothing was written this week.')

  return { week: weekStart(ts), body: parts.join('\n\n') + '\n', pages: gathered.length }
}
