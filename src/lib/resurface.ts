import { JOURNAL_NOTEBOOK, isBlank, type Page } from './model.ts'

/* One old page per day, with a dated page from this time of year first. */
export function pageToRevisit(pages: Page[], today: string): Page | undefined {
  const now = new Date(`${today}T12:00:00`).getTime()
  const old = pages.filter((page) =>
    !page.deleted && page.notebook !== JOURNAL_NOTEBOOK && !isBlank(page.body) &&
    now - page.created >= 30 * 86_400_000,
  )
  if (!old.length) return undefined
  const [, month, day] = today.split('-')
  const anniversary = old.filter((page) => (page.entryDate ?? '').slice(5) === `${month}-${day}` && page.entryDate !== today)
  const candidates = anniversary.length ? anniversary : old
  candidates.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))
  const dayNumber = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000)
  return candidates[dayNumber % candidates.length]
}
