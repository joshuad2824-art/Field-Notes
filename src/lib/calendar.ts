import { isoDay } from './format'
import type { Page } from './model'

/* The day a page sits on, in one place.

   `entryDate` when the page has been given one, and the day it was written
   otherwise. Written, not last touched: a journal whose March page jumps to
   August because a typo was fixed in it is telling you about the typo, not
   about March. */
export function dayOf(page: Pick<Page, 'entryDate' | 'created'>): string {
  return page.entryDate ?? isoDay(page.created)
}

export function isoMonth(iso: string): string {
  return iso.slice(0, 7)
}

export function monthNow(): string {
  return isoMonth(isoDay())
}

/* A calendar month is always six weeks of seven, so the grid never changes
   height as you step through the year and the page under it never jumps. */
export interface CalendarDay {
  iso: string
  date: number
  inMonth: boolean
}

export function monthOf(month: string): CalendarDay[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return {
      iso: isoDay(day.getTime()),
      date: day.getDate(),
      inMonth: day.getMonth() === m - 1,
    }
  })
}

export function stepMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const at = new Date(y, m - 1 + by, 1)
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
}

const monthYear = new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' })
const monthOnly = new Intl.DateTimeFormat([], { month: 'long' })

export function monthParts(month: string): { month: string; year: string } {
  const [y, m] = month.split('-').map(Number)
  const at = new Date(y, m - 1, 1)
  return { month: monthOnly.format(at), year: String(y) }
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return monthYear.format(new Date(y, m - 1, 1))
}

/* Sunday first, to match the strip this grew out of. */
export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
