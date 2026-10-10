import type { FieldEvent } from './model.ts'

import { validDate, recurrenceError, recurrenceStarts, shiftDate, dayNumber } from './event-recurrence.ts'
export { validDate } from './event-recurrence.ts'

export function eventEnd(event: Pick<FieldEvent, 'date' | 'endDate'>): string {
  return event.endDate && event.endDate > event.date ? event.endDate : event.date
}

export function eventOnDay(event: Pick<FieldEvent, 'date' | 'endDate' | 'recurrence' | 'seriesId'>, day: string): boolean {
  if (event.recurrence && !event.seriesId) {
    const duration = dayNumber(eventEnd(event)) - dayNumber(event.date)
    return recurrenceStarts(event, shiftDate(day, -duration), day, 1).length > 0
  }
  return event.date <= day && eventEnd(event) >= day
}

/* Enumerate only the displayed month, even for a very long event. */
export function eventDaysInMonth(event: Pick<FieldEvent, 'date' | 'endDate' | 'recurrence' | 'seriesId'>, month: string): string[] {
  const days: string[] = []
  for (let n = 1; n <= 31; n++) {
    const day = `${month}-${String(n).padStart(2, '0')}`
    if (validDate(day) && eventOnDay(event, day)) days.push(day)
  }
  return days
}

export function eventRangeError(event: Pick<FieldEvent, 'date' | 'endDate' | 'startTime' | 'endTime' | 'recurrence'>): string | undefined {
  if (!validDate(event.date)) return 'Choose a valid start date.'
  if (event.endDate && (!validDate(event.endDate) || event.endDate < event.date)) return 'End date must be on or after the start date.'
  const repeat = recurrenceError(event.recurrence, event.date)
  if (repeat) return repeat
  const clock = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  if ([event.startTime, event.endTime].some(time => time && !clock.test(time))) return 'Choose a valid time.'
  if (event.endTime && !event.startTime) return 'Add a start time before an end time.'
  if (event.startTime && event.endDate && event.endDate > event.date && !event.endTime) return 'Add an end time for an event spanning several days, or leave both times blank for an all-day event.'
  if (event.startTime && event.endTime && eventEnd(event) === event.date && event.endTime <= event.startTime) return 'End time must follow start time.'
}
