import { isoDay } from './format.ts'
import type { FieldEvent, SienaItem } from './model.ts'

export interface AgendaDay {
  iso: string
  events: FieldEvent[]
  reminders: SienaItem[]
}

/* The current day already has a full card on Overview. This is the seven
   following local calendar days, built by date parts so DST never skips one. */
export function weekAhead(today: string, events: FieldEvent[], items: SienaItem[]): AgendaDay[] {
  const [year, month, day] = today.split('-').map(Number)
  return Array.from({ length: 7 }, (_, index) => {
    const at = new Date(year, month - 1, day + index + 1, 12)
    const iso = isoDay(at.getTime())
    return {
      iso,
      events: events.filter((event) => !event.deleted && event.date === iso)
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title)),
      reminders: items.filter((item) => item.type === 'reminder' && !item.completedAt && item.dueAt !== undefined &&
        isoDay(item.dueAt) === iso).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    }
  }).filter((entry) => entry.events.length || entry.reminders.length)
}
