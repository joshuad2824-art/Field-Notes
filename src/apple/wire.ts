/* What the apple-calendar function sends, checked before anything is shown.

   Read only. The function can fetch a feed and nothing more, and this side
   keeps what it is given in memory: no Field Notes database writes, no notes
   made from events, nothing that could travel back to Apple. */

export interface AppleWireEvent {
  id: string
  title: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  allDay: boolean
  location?: string
  note?: string
}

export interface AppleSnapshot {
  calendarName?: string
  timezone: string
  from: string
  to: string
  fetchedAt: string
  stale: boolean // the function served its last good copy because iCloud didn't answer
  skipped: number // repeating events whose rules weren't understood (first date shown only)
  truncated: boolean
  events: AppleWireEvent[]
}

export interface AppleRange {
  from: string
  to: string
}

const invalid = (): never => {
  throw new Error('The Apple Calendar response was incomplete or invalid')
}

const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid()

function text(v: unknown, max: number, required = false): string {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) return invalid()
  return v
}

export function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v
}

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function decodeApple(value: unknown, range: AppleRange, timezone: string): AppleSnapshot {
  const s = object(value)
  if (
    s.schemaVersion !== 1 ||
    s.readOnly !== true ||
    s.source !== 'apple-calendar' ||
    s.from !== range.from ||
    s.to !== range.to ||
    s.timezone !== timezone
  ) {
    invalid()
  }
  const fetchedAt = text(s.fetchedAt, 40, true)
  if (!Number.isFinite(Date.parse(fetchedAt))) invalid()
  if (!Array.isArray(s.events) || s.events.length > 3000) invalid()
  const events = new Map<string, AppleWireEvent>()
  for (const raw of s.events as unknown[]) {
    const e = object(raw)
    const date = e.date
    if (!validDate(date)) invalid()
    const endDate = e.endDate === undefined ? undefined : e.endDate
    if (endDate !== undefined && (!validDate(endDate) || endDate < (date as string))) invalid()
    for (const time of [e.startTime, e.endTime]) {
      if (time !== undefined && (typeof time !== 'string' || !CLOCK.test(time))) invalid()
    }
    if (typeof e.allDay !== 'boolean') invalid()
    const id = text(e.id, 700, true)
    events.set(id, {
      id,
      title: text(e.title, 400),
      date: date as string,
      ...(endDate ? { endDate: endDate as string } : {}),
      ...(typeof e.startTime === 'string' ? { startTime: e.startTime } : {}),
      ...(typeof e.endTime === 'string' ? { endTime: e.endTime } : {}),
      allDay: e.allDay as boolean,
      ...(e.location === undefined ? {} : { location: text(e.location, 400) }),
      ...(e.note === undefined ? {} : { note: text(e.note, 2500) }),
    })
  }
  return {
    ...(typeof s.calendarName === 'string' ? { calendarName: text(s.calendarName, 200) } : {}),
    timezone,
    from: range.from,
    to: range.to,
    fetchedAt,
    stale: s.stale === true,
    skipped: Number.isInteger(s.skipped) ? (s.skipped as number) : 0,
    truncated: s.truncated === true,
    events: [...events.values()],
  }
}
