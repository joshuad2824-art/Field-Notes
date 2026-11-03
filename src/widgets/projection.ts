import { dayOf } from '../lib/calendar.ts'
import { eventOnDay } from '../lib/event-range.ts'
import { shiftDate, validDate } from '../lib/event-recurrence.ts'
import { JOURNAL_NOTEBOOK, type Page, type FieldEvent } from '../lib/model.ts'

export type SourceStatus = 'ready' | 'loading' | 'setup' | 'disconnected' | 'denied' | 'stale' | 'offline' | 'unavailable' | 'error'
export interface WidgetSnapshot {
  version: 1
  from: string
  to: string
  timezone: string
  written: string[]
  events: string[]
  sources: { davis: SourceStatus; apple: SourceStatus; work: SourceStatus }
}

// The same page-day and event-day rules as Today's MonthGrid. Only dates leave
// this boundary: never page/event IDs, text, notebook names, or credentials.
export function calendarProjection(pages: Page[], events: FieldEvent[], from: string, to: string,
  sources: WidgetSnapshot['sources'], timezone: string): WidgetSnapshot {
  if (!validDate(from) || !validDate(to) || to < from || shiftDate(from, 399) < to)
    throw new Error('Invalid widget calendar window.')
  const written = [...new Set(pages.filter(p => !p.deleted && p.notebook !== JOURNAL_NOTEBOOK)
    .map(dayOf).filter(day => day >= from && day <= to))].sort()
  const marked: string[] = []
  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    if (events.some(event => !event.deleted && eventOnDay(event, day))) marked.push(day)
  }
  return { version: 1, from, to, timezone, written, events: marked,
    sources: { davis: sources.davis, apple: sources.apple, work: sources.work } }
}
