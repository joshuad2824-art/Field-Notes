import type { FieldEvent } from './model.ts'

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function eventEnd(event: Pick<FieldEvent, 'date' | 'endDate'>): string {
  return event.endDate && event.endDate > event.date ? event.endDate : event.date
}

export function eventOnDay(event: Pick<FieldEvent, 'date' | 'endDate'>, day: string): boolean {
  return event.date <= day && eventEnd(event) >= day
}

/* Enumerate only the displayed month, even for a very long event. */
export function eventDaysInMonth(event: Pick<FieldEvent, 'date' | 'endDate'>, month: string): string[] {
  const days: string[] = []
  for (let n = 1; n <= 31; n++) {
    const day = `${month}-${String(n).padStart(2, '0')}`
    if (validDate(day) && eventOnDay(event, day)) days.push(day)
  }
  return days
}

export function eventRangeError(event: Pick<FieldEvent, 'date' | 'endDate' | 'startTime' | 'endTime'>): string | undefined {
  if (!validDate(event.date)) return 'Choose a valid start date.'
  if (event.endDate && (!validDate(event.endDate) || event.endDate < event.date)) return 'End date must be on or after the start date.'
  const clock = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  if ([event.startTime, event.endTime].some(time => time && !clock.test(time))) return 'Choose a valid time.'
  if (event.endTime && !event.startTime) return 'Add a start time before an end time.'
  if (event.startTime && event.endDate && event.endDate > event.date && !event.endTime) return 'Add an end time for an event spanning several days, or leave both times blank for an all-day event.'
  if (event.startTime && event.endTime && eventEnd(event) === event.date && event.endTime <= event.startTime) return 'End time must follow start time.'
}
