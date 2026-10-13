export interface WorkWireEvent {
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

export interface WorkSnapshot {
  calendarName?: string
  timezone: string
  from: string
  to: string
  fetchedAt: string
  stale: boolean // last successful scheduled update is older than 26 hours
  skipped: number // Google supplies expanded occurrences
  truncated: boolean
  events: WorkWireEvent[]
}

export interface WorkRange {
  from: string
  to: string
}

const invalid = (): never => {
  throw new Error('The Work Calendar response was incomplete or invalid')
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

export function decodeWork(value: unknown, range: WorkRange, timezone: string): WorkSnapshot {
  const row = object(value)
  if (row.source_calendar !== 'joshua.davis5@ascension.org' || row.timezone !== 'America/Chicago' || !validDate(row.from_date) || !validDate(row.to_date)) invalid()
  if (timezone !== row.timezone) throw new Error('Work calendar uses America/Chicago time')
  const s = { events: row.events, ...row, fetchedAt: row.fetched_at, calendarName: 'CI · Josh Davis', stale: Date.now() - Date.parse(String(row.fetched_at)) > 26 * 3600000, skipped: 0, truncated: range.from < String(row.from_date) || range.to > String(row.to_date) }
  const fetchedAt = text(s.fetchedAt, 40, true)
  if (!Number.isFinite(Date.parse(fetchedAt))) invalid()
  if (!Array.isArray(s.events) || s.events.length > 3000) invalid()
  const events = new Map<string, WorkWireEvent>()
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
    from: String(row.from_date),
    to: String(row.to_date),
    fetchedAt,
    stale: s.stale === true,
    skipped: Number.isInteger(s.skipped) ? (s.skipped as number) : 0,
    truncated: s.truncated === true,
    events: [...events.values()],
  }
}
