import type { AgendaSnapshot } from './agenda'

export const DAVIS_SOURCE_URL = 'https://davis-at-home.netlify.app'
export interface DavisSource {
  provider: 'davis-at-home'; householdId: string; collection: 'events' | 'reminders'; id: string
  version: number; ownerId: string | null; audience: 'household' | 'adults'
}
export interface DavisEvent {
  id: string; source: DavisSource
  series: { date: string; endDate: string | null; repeat: 'Once' | 'Daily' | 'Weekly' | 'Selected days'; weekdays: string; repeatUntil: string | null }
  title: string; date: string; endDate: string; time: string | null; person?: string
  location: string; note: string; kind: string
}
export interface DavisReminder { id: string; source: DavisSource; title: string; date: string; person?: string }
export interface DavisAgendaSnapshot {
  schemaVersion: 1; readOnly: true; complete: true; accountId: string; householdId: string
  timezone: string; today: string; from: string; to: string; fetchedAt: string
  sourceUrl: typeof DAVIS_SOURCE_URL; events: DavisEvent[]; reminders: DavisReminder[]
}
export interface AgendaRange { from: string; to: string }
export interface DavisIdentity { accountId: string; householdId?: string }
export class DavisIdentityError extends Error { constructor() { super('Davis identity changed') } }
const invalid = () => { throw new Error('Davis returned an incomplete or invalid agenda') }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid()
const string = (v: unknown, nonempty = false): string => typeof v === 'string' && (!nonempty || v.trim()) ? v : invalid()
export function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v
}
export function shiftDate(day: string, offset: number): string {
  if (!validDate(day)) return invalid()
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function datesIn(range: AgendaRange): string[] {
  validateRange(range)
  const dates: string[] = []
  for (let day = range.from; day <= range.to; day = shiftDate(day, 1)) dates.push(day)
  return dates
}
export function validateRange(range: AgendaRange): void {
  if (!validDate(range.from) || !validDate(range.to) || range.from > range.to || (+new Date(`${range.to}T12:00:00Z`) - +new Date(`${range.from}T12:00:00Z`)) / 86400000 >= 93) invalid()
}
function date(v: unknown): string { return validDate(v) ? v : invalid() }
function nullableDate(v: unknown): string | null { return v === null ? null : date(v) }
function source(v: unknown, household: string, collection: 'events' | 'reminders'): DavisSource {
  const s = object(v)
  if (s.provider !== 'davis-at-home' || s.householdId !== household || s.collection !== collection || !Number.isInteger(s.version) || (s.version as number) < 1 || !['household', 'adults'].includes(s.audience as string)) invalid()
  return { provider: 'davis-at-home', householdId: household, collection, id: string(s.id, true), version: s.version as number, ownerId: s.ownerId === null ? null : string(s.ownerId, true), audience: s.audience as DavisSource['audience'] }
}
export function decodeAgenda(value: unknown, range: AgendaRange, identity: DavisIdentity): DavisAgendaSnapshot {
  validateRange(range)
  const s = object(value)
  if (s.schemaVersion !== 1 || s.readOnly !== true || s.complete !== true || s.sourceUrl !== DAVIS_SOURCE_URL || s.from !== range.from || s.to !== range.to) invalid()
  const accountId = string(s.accountId, true), householdId = string(s.householdId, true)
  if (accountId !== identity.accountId || (identity.householdId && householdId !== identity.householdId)) throw new DavisIdentityError()
  const timezone = string(s.timezone, true)
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { invalid() }
  const today = date(s.today), fetchedAt = string(s.fetchedAt)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(fetchedAt) || !validDate(fetchedAt.slice(0, 10)) || !Number.isFinite(Date.parse(fetchedAt))) invalid()
  if (!Array.isArray(s.events) || !Array.isArray(s.reminders) || s.events.length > 5000 || s.reminders.length > 1000) invalid()
  const ids = new Set<string>(), records = new Set<string>()
  function distinct(id: string, src: DavisSource) { if (ids.has(id)) invalid(); ids.add(id); records.add(`${src.collection}:${src.id}`) }
  const events: DavisEvent[] = (s.events as unknown[]).map((v) => {
    const e = object(v), src = source(e.source, householdId, 'events'), series = object(e.series)
    const start = date(e.date), end = date(e.endDate)
    if (end < start || end < range.from || start > range.to || (+new Date(`${end}T12:00:00Z`) - +new Date(`${start}T12:00:00Z`)) / 86400000 >= 3660) invalid()
    const seriesDate = date(series.date), seriesEnd = nullableDate(series.endDate), repeatUntil = nullableDate(series.repeatUntil)
    if (seriesEnd && seriesEnd < seriesDate) invalid()
    if (!['Once', 'Daily', 'Weekly', 'Selected days'].includes(series.repeat as string)) invalid()
    const weekdays = string(series.weekdays)
    if (weekdays && !/^[0-6](?:,[0-6])*$/.test(weekdays)) invalid()
    if (e.time !== null && (typeof e.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.time))) invalid()
    const id = string(e.id, true); distinct(id, src)
    return { id, source: src, series: { date: seriesDate, endDate: seriesEnd, repeat: series.repeat as DavisEvent['series']['repeat'], weekdays, repeatUntil }, title: string(e.title), date: start, endDate: end, time: e.time as string | null, ...(e.person === undefined ? {} : { person: string(e.person) }), location: string(e.location), note: string(e.note), kind: string(e.kind) }
  })
  const reminders: DavisReminder[] = (s.reminders as unknown[]).map((v) => {
    const r = object(v), src = source(r.source, householdId, 'reminders'), due = date(r.date), id = string(r.id, true)
    if (due > range.to) invalid()
    distinct(id, src)
    return { id, source: src, title: string(r.title), date: due, ...(r.person === undefined ? {} : { person: string(r.person) }) }
  })
  if (records.size > 1000) invalid()
  return { schemaVersion: 1, readOnly: true, complete: true, accountId, householdId, timezone, today, from: range.from, to: range.to, fetchedAt, sourceUrl: DAVIS_SOURCE_URL, events, reminders }
}
export function projectAgenda(wire: DavisAgendaSnapshot): AgendaSnapshot {
  return { accountId: wire.accountId, householdId: wire.householdId, timezone: wire.timezone, today: wire.today, fetchedAt: wire.fetchedAt, from: wire.from, to: wire.to, sourceUrl: wire.sourceUrl, entries: [
    ...wire.events.map((event) => ({ sourceId: event.id, version: String(event.source.version), source: event.source, title: event.title, kind: 'event' as const, startDate: event.date, endDate: event.endDate, ...(event.time ? { time: event.time } : {}), ...(event.person === undefined ? {} : { owner: event.person }), audience: event.source.audience, location: event.location, note: event.note })),
    ...wire.reminders.map((reminder) => ({ sourceId: reminder.id, version: String(reminder.source.version), source: reminder.source, title: reminder.title, kind: 'reminder' as const, startDate: reminder.date, ...(reminder.person === undefined ? {} : { owner: reminder.person }), audience: reminder.source.audience })),
  ] }
}
