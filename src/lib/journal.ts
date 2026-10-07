import { createPage, db, patchPage } from './db'
import { digestOf, weekStart } from './digest'
import { JOURNAL_NOTEBOOK, type Page } from './model'
import { notebookForPage } from './notebooks'

/* The journal's step one, where it meets the database.

   Everything about what a week *reads as* is in `digest.ts` and is provable on
   node. This file is the thin layer that reads the pages, hands them over, and
   writes the one page that comes back. Assembly is mechanical and offline;
   the prose pass in `src/writeup/` is a separate, optional second step, and
   the reason for that ordering is that the feature which ships is the one that
   cannot fail. */

export { lastWeekAt, weekStart } from './digest'

/* The most recently edited review for a week, if there is one. Keyed on notebook plus
   `entryDate`, which is what makes opening the same week twice preserve the
   existing review rather than replace its writing — the same discipline as `once()` in
   `capture.ts` and "restore twice, get one page" in `export.ts`. */
export async function entryForWeek(week: string): Promise<Page | undefined> {
  const rows = await db.pages.toArray()
  return rows
    .filter((p) => !p.deleted && p.notebook === JOURNAL_NOTEBOOK && p.entryDate === week)
    .sort((a, b) => b.updated - a.updated)[0]
}

export interface Collected {
  id: string
  week: string
  pages: number
  openedExisting: boolean
}

/* Reopening preserves edits. Gathering a fresh copy preserves the old review.
   Manual, and it stays manual until it has been lived with. Nothing in this
   app writes to your pages because a clock said so. */
export async function collectWeek(ts: number = Date.now(), freshCopy = false): Promise<Collected> {
  const digest = digestOf(ts, await db.pages.toArray(), (id) => notebookForPage(id).name)
  const standing = await entryForWeek(digest.week)

  if (standing && !freshCopy) {
    return { id: standing.id, week: digest.week, pages: digest.pages, openedExisting: true }
  }

  /* Created and then stamped, rather than a row assembled here: `createPage`
     is the one place a page is made and its uuid is not this file's business.
     The `entryDate` is what the next collection will find it by. */
  const body = standing && freshCopy
    ? digest.body.replace(/^(# .+)$/m, '$1 · updated notes')
    : digest.body
  const page = await createPage(JOURNAL_NOTEBOOK, body)
  await patchPage(page.id, { entryDate: weekStart(ts) })
  return { id: page.id, week: digest.week, pages: digest.pages, openedExisting: false }
}
