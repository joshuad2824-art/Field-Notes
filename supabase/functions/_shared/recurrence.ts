/* Calendar values stay as local dates. UTC is used only for date arithmetic,
   so daylight-saving changes cannot move a repeat to the previous day. */
export interface EventRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  weekdays?: number[] // Sunday = 0; weekly only
  monthDay?: number // 1..31, or -1 for the last day
  monthWeek?: number // 1..5, or -1 for the last weekday
  weekday?: number
  until?: string // inclusive final start date
  count?: number
}
export interface RecurringDate { date: string; endDate?: string; recurrence?: EventRecurrence; seriesId?: string }
const DAY = 86_400_000
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function dayNumber(iso: string) { return Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / DAY) }
export function dateFromDay(day: number) { return new Date(day * DAY).toISOString().slice(0, 10) }
export function shiftDate(iso: string, days: number) { return dateFromDay(dayNumber(iso) + days) }
export function dateWeekday(iso: string) { return new Date(`${iso}T12:00:00Z`).getUTCDay() }
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
export function recurrenceError(value: unknown, start: string): string | undefined {
  if (value === undefined || value === null) return
  if (!validDate(start)) return 'Choose a valid start date for the repeat schedule.'
  if (typeof value !== 'object' || Array.isArray(value)) return 'Choose a valid repeat schedule.'
  const r = value as Record<string, unknown>
  if (Object.keys(r).some(k => !['frequency','interval','weekdays','monthDay','monthWeek','weekday','until','count'].includes(k))) return 'Unrecognized repeat option.'
  if (!['daily','weekly','monthly','yearly'].includes(String(r.frequency)) || !integer(r.interval, 1, 99)) return 'Repeat every 1 to 99 days, weeks, months, or years.'
  if (r.until !== undefined && (typeof r.until !== 'string' || !validDate(r.until) || r.until < start)) return 'The repeat end date must be on or after the start date.'
  if (r.count !== undefined && !integer(r.count, 1, 9999)) return 'Choose 1 to 9,999 occurrences.'
  if (r.until !== undefined && r.count !== undefined) return 'Choose an end date or an occurrence count, not both.'
  if (r.frequency === 'weekly') {
    if (!Array.isArray(r.weekdays) || !r.weekdays.length || r.weekdays.length > 7 || r.weekdays.some(d => !integer(d, 0, 6)) || new Set(r.weekdays).size !== r.weekdays.length) return 'Choose at least one weekday.'
  } else if (r.weekdays !== undefined) return 'Weekday choices belong to weekly repeats.'
  if (r.frequency === 'monthly') {
    const date = r.monthDay === -1 || integer(r.monthDay, 1, 31)
    const weekday = (r.monthWeek === -1 || integer(r.monthWeek, 1, 5)) && integer(r.weekday, 0, 6)
    if (date === weekday || (date && (r.monthWeek !== undefined || r.weekday !== undefined)) || (weekday && r.monthDay !== undefined)) return 'Choose a date or a particular weekday each month.'
  } else if (r.monthDay !== undefined || r.monthWeek !== undefined || r.weekday !== undefined) return 'Monthly choices belong to monthly repeats.'
}
function monthDate(index: number, r: EventRecurrence): string | undefined {
  const year = Math.floor(index / 12), month = index % 12 + 1
  if (year < 0 || year > 9999) return
  const prefix = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}`
  let last = 31; while (!validDate(`${prefix}-${last}`)) last--
  let day: number
  if (r.monthDay !== undefined) day = r.monthDay === -1 ? last : r.monthDay
  else if (r.monthWeek === -1) day = last - (dateWeekday(`${prefix}-${last}`) - r.weekday! + 7) % 7
  else day = 1 + (r.weekday! - dateWeekday(`${prefix}-01`) + 7) % 7 + (r.monthWeek! - 1) * 7
  const iso = `${prefix}-${String(day).padStart(2,'0')}`
  return validDate(iso) ? iso : undefined
}
/* Expand only the requested window. Missing dates (31st, fifth Sunday,
   leap day) are skipped and do not consume the occurrence count. */
export function recurrenceStarts(event: RecurringDate, from: string, to: string, limit = Infinity): string[] {
  const r = event.recurrence
  if (!validDate(event.date) || !validDate(from) || !validDate(to) || from > to) return []
  if (!r || event.seriesId) return event.date >= from && event.date <= to ? [event.date] : []
  if (recurrenceError(r, event.date)) return []
  const anchor = dayNumber(event.date), low = Math.max(anchor, dayNumber(from)), high = Math.min(dayNumber(to), r.until ? dayNumber(r.until) : Infinity)
  if (low > high) return []
  const result: string[] = []
  const add = (iso: string, ordinal: number) => {
    const day = dayNumber(iso)
    if (r.count && ordinal > r.count) return false
    if (day >= low && day <= high) result.push(iso)
    return result.length < limit
  }
  if (r.frequency === 'daily') {
    for (let i = Math.ceil((low-anchor)/r.interval); anchor+i*r.interval <= high; i++) {
      if (!add(dateFromDay(anchor+i*r.interval), i+1)) break
    }
  } else if (r.frequency === 'weekly') {
    const offsets = r.weekdays!.map(d => (d+6)%7).sort((a,b)=>a-b)
    const week = anchor-(dateWeekday(event.date)+6)%7, step = 7*r.interval
    const omitted = offsets.filter(d => week+d < anchor).length
    outer: for (let k = Math.max(0,Math.floor((low-week)/step)); week+k*step <= high; k++) {
      for (let n = 0; n < offsets.length; n++) {
        const day = week+k*step+offsets[n]
        if (day < anchor || day > high) continue
        if (!add(dateFromDay(day), k*offsets.length+n+1-omitted)) break outer
      }
    }
  } else {
    const [year, month] = event.date.split('-').map(Number)
    const anchorMonth = year*12+month-1, lowDate = dateFromDay(low), [lowYear, lowMonth] = lowDate.split('-').map(Number)
    const step = r.frequency === 'monthly' ? r.interval : r.interval*12
    let ordinal = 0
    const first = r.count ? 0 : Math.max(0,Math.floor((lowYear*12+lowMonth-1-anchorMonth)/step))
    for (let k = first; ; k++) {
      const index = anchorMonth+k*step
      if (index > 9999*12+11) break
      const periodStart = `${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}-01`
      if (dayNumber(periodStart) > high) break
      const iso = monthDate(index, r.frequency === 'yearly' ? { ...r, monthDay: Number(event.date.slice(8)) } : r)
      if (!iso || iso < event.date) continue
      ordinal++
      if (!add(iso, ordinal)) break
    }
  }
  return result
}
export function recurrencePreview(event: RecurringDate, limit = 4): string[] {
  if (!validDate(event.date)) return []
  const end = shiftDate(event.date, Math.min(36600, dayNumber('9999-12-31')-dayNumber(event.date)))
  return recurrenceStarts(event, event.date, end, limit)
}
export function normalizedRecurringDate<T extends RecurringDate>(event: T): T {
  if (!event.recurrence) return event
  const first = recurrencePreview(event, 1)[0]
  if (!first) throw new Error('This schedule has no occurrences before its end. Adjust the start date or repeat options.')
  return { ...event, date: first, ...(event.endDate ? { endDate: shiftDate(event.endDate, dayNumber(first)-dayNumber(event.date)) } : {}) }
}
export function expandEvents<T extends RecurringDate & { id: string }>(events: T[], from: string, to: string): (T & { seriesId?: string; occurrenceDate?: string })[] {
  return events.flatMap(event => {
    const duration = event.endDate ? Math.max(0, dayNumber(event.endDate)-dayNumber(event.date)) : 0
    if (!event.recurrence || event.seriesId) return event.date <= to && (event.endDate ?? event.date) >= from ? [event] : []
    return recurrenceStarts(event, shiftDate(from, -duration), to).map(date => ({ ...event, id: `${event.id}@${date}`, seriesId: event.id, occurrenceDate: date, date, ...(event.endDate ? { endDate: shiftDate(date, duration) } : {}) }))
  })
}
export const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export function recurrenceSummary(r?: EventRecurrence): string {
  if (!r) return 'Does not repeat'
  const unit = {daily:'day',weekly:'week',monthly:'month',yearly:'year'}[r.frequency]
  const base = r.interval === 1 ? `Every ${unit}` : `Every ${r.interval} ${unit}s`
  const on = r.frequency === 'weekly' ? ` on ${r.weekdays!.map(d=>WEEKDAYS[d]).join(', ')}` : r.frequency === 'monthly' ? r.monthDay !== undefined ? r.monthDay === -1 ? ' on the last day' : ` on day ${r.monthDay}` : ` on the ${r.monthWeek === -1 ? 'last' : ['','first','second','third','fourth','fifth'][r.monthWeek!]} ${WEEKDAYS[r.weekday!]}` : ''
  return `${base}${on}${r.until ? ` through ${r.until}` : r.count ? ` · ${r.count} occurrence${r.count === 1 ? '' : 's'}` : ''}`
}
export function recurrenceRule(r: EventRecurrence, timed: boolean): string {
  const names = ['SU','MO','TU','WE','TH','FR','SA']
  const parts = [`FREQ=${r.frequency.toUpperCase()}`, `INTERVAL=${r.interval}`]
  if (r.frequency === 'weekly') parts.push(`BYDAY=${r.weekdays!.map(d=>names[d]).join(',')}`, 'WKST=MO')
  if (r.frequency === 'monthly') parts.push(r.monthDay !== undefined ? `BYMONTHDAY=${r.monthDay}` : `BYDAY=${r.monthWeek}${names[r.weekday!]}`)
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g,'')}${timed ? 'T235959' : ''}`)
  if (r.count) parts.push(`COUNT=${r.count}`)
  return parts.join(';')
}
