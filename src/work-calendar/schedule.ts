import { eventOnDay } from '../lib/event-range.ts'
import { shiftDate } from '../lib/event-recurrence.ts'
import type { FieldEvent } from '../lib/model.ts'

/* Where work events show. The St. John desk carries the whole work schedule;
   Today carries only what is happening today, and its "Coming up" is for the
   rest of life: family, school, church. Pure, so node can check it. */

type Sourced = Pick<FieldEvent, 'date' | 'endDate'> & { externalSource?: string }

export const isWorkEvent = (event: { externalSource?: string }): boolean => event.externalSource === 'work'

/* Everything except work, for the places work should not crowd. */
export function withoutWork<E extends { externalSource?: string }>(events: E[]): E[] {
  return events.filter((event) => !isWorkEvent(event))
}

export interface ScheduleDay<E> {
  iso: string
  events: E[]
}

const byTime = <E extends Pick<FieldEvent, 'startTime' | 'title'>>(a: E, b: E) =>
  (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title)

/* `days` calendar days from `from`, in order. Today is always listed, empty or
   not, so the page can say so; later days appear only when something is on
   them. A multi-day event is listed on each day it covers. */
export function scheduleDays<E extends Sourced & Pick<FieldEvent, 'startTime' | 'title'>>(
  events: E[],
  from: string,
  days = 14,
): ScheduleDay<E>[] {
  return Array.from({ length: days }, (_, index) => {
    const iso = shiftDate(from, index)
    return { iso, events: events.filter((event) => eventOnDay(event, iso)).sort(byTime) }
  }).filter((day, index) => index === 0 || day.events.length)
}
