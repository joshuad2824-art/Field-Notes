/* Reads a published iCloud calendar feed (iCalendar text) and expands it into
   the events that fall inside one window of days, already placed in the
   viewer's own time zone.

   Pure functions only: no Deno, no Node, no network. The edge function and the
   tests import this same file, so what the tests check is what runs.

   Scope, stated plainly so nothing here claims more than it does:
   - Events (VEVENT). Nothing else in the feed is read.
   - Repeats: DAILY, WEEKLY, MONTHLY and YEARLY with INTERVAL, COUNT, UNTIL,
     BYDAY (with ordinals like 2SU and -1FR), BYMONTHDAY, BYMONTH, BYSETPOS,
     WKST, EXDATE, RDATE, and single-instance edits (RECURRENCE-ID).
   - A repeat rule using anything else (BYYEARDAY, BYWEEKNO, sub-daily
     frequencies, an unparseable rule) is not guessed at. Its first occurrence
     is shown and the event is counted in `skipped`.
   - "This and future" edits are treated as single-instance edits. */

export interface AppleEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD in the viewer's time zone
  endDate?: string // inclusive final day; absent for a single-day event
  startTime?: string // HH:MM in the viewer's time zone; absent for all-day
  endTime?: string
  allDay: boolean
  location?: string
  note?: string
}

export interface ExpandResult {
  calendarName?: string
  events: AppleEvent[]
  skipped: number
  truncated: boolean
}

/* ── lines ─────────────────────────────────────────────────────────────── */

interface Prop {
  name: string
  params: Record<string, string>
  value: string
}

function splitOutside(text: string, separator: string): string[] {
  const parts: string[] = []
  let quoted = false
  let current = ''
  for (const char of text) {
    if (char === '"') quoted = !quoted
    if (char === separator && !quoted) {
      parts.push(current)
      current = ''
    } else current += char
  }
  parts.push(current)
  return parts
}

function parseLine(line: string): Prop | null {
  let quoted = false
  let cut = -1
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') quoted = !quoted
    else if (char === ':' && !quoted) {
      cut = i
      break
    }
  }
  if (cut < 1) return null
  const [name, ...rawParams] = splitOutside(line.slice(0, cut), ';')
  const params: Record<string, string> = {}
  for (const raw of rawParams) {
    const eq = raw.indexOf('=')
    if (eq > 0) params[raw.slice(0, eq).toUpperCase()] = raw.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value: line.slice(cut + 1) }
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_all, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char,
  )
}

function clean(value: string | undefined, max: number): string {
  if (!value) return ''
  // eslint-disable-next-line no-control-regex
  const text = unescapeText(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  return text.trim().slice(0, max)
}

function collect(source: string): { blocks: Prop[][]; calendar: Record<string, string> } {
  const lines = source.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const blocks: Prop[][] = []
  const calendar: Record<string, string> = {}
  let current: Prop[] | null = null
  let alarm = 0
  for (const line of lines) {
    if (!line) continue
    const prop = parseLine(line)
    if (!prop) continue
    if (prop.name === 'BEGIN') {
      const kind = prop.value.trim().toUpperCase()
      if (kind === 'VEVENT') current = []
      else if (kind === 'VALARM' && current) alarm++
      continue
    }
    if (prop.name === 'END') {
      const kind = prop.value.trim().toUpperCase()
      if (kind === 'VEVENT' && current) {
        blocks.push(current)
        current = null
        alarm = 0
      } else if (kind === 'VALARM' && alarm) alarm--
      continue
    }
    if (alarm) continue
    if (current) current.push(prop)
    else if (prop.name === 'X-WR-CALNAME') calendar[prop.name] = prop.value
  }
  return { blocks, calendar }
}

/* ── time zones ────────────────────────────────────────────────────────── */

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string): Intl.DateTimeFormat {
  let found = formatters.get(zone)
  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(zone, found)
  }
  return found
}

export function validZone(zone: string): boolean {
  try {
    formatter(zone)
    return true
  } catch {
    return false
  }
}

interface Wall {
  y: number
  m: number
  d: number
  h: number
  mi: number
  s: number
}

function wallOf(ms: number, zone: string): Wall {
  const parts: Record<string, number> = {}
  for (const part of formatter(zone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    y: parts.year,
    m: parts.month,
    d: parts.day,
    h: parts.hour === 24 ? 0 : parts.hour,
    mi: parts.minute,
    s: parts.second,
  }
}

const asUtc = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s)

/* A wall-clock reading in a zone → the instant it names. Two passes settle
   the offset on either side of a daylight-saving change. */
function instantOf(w: Wall, zone: string): number {
  const naive = asUtc(w)
  const first = naive - (asUtc(wallOf(naive, zone)) - naive)
  return naive - (asUtc(wallOf(first, zone)) - first)
}

/* ── dates ─────────────────────────────────────────────────────────────── */

const DAY = 86_400_000
const pad = (n: number, width = 2) => String(n).padStart(width, '0')
const dayNumber = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / DAY)
const weekday = (n: number) => (((n + 4) % 7) + 7) % 7 // 0 is Sunday
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

function ymd(n: number): { y: number; m: number; d: number } {
  const date = new Date(n * DAY)
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

function iso(n: number): string {
  const { y, m, d } = ymd(n)
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`
}

const isoWall = (w: Wall) => `${pad(w.y, 4)}-${pad(w.m)}-${pad(w.d)}`
const hhmm = (w: Wall) => `${pad(w.h)}:${pad(w.mi)}`

export function isoToDayNumber(value: string): number {
  const [y, m, d] = value.split('-').map(Number)
  return dayNumber(y, m, d)
}

interface Dt {
  allDay: boolean
  y: number
  m: number
  d: number
  h: number
  mi: number
  tz: string | null // an IANA zone, 'UTC', or null for a floating time
}

const DT = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/

function parseDt(value: string, params: Record<string, string>): Dt | null {
  const match = DT.exec(value.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null
  const allDay = match[4] === undefined || params.VALUE === 'DATE'
  if (allDay) return { allDay: true, y, m, d, h: 0, mi: 0, tz: null }
  const h = Number(match[4])
  const mi = Number(match[5])
  if (h > 23 || mi > 59) return null
  let tz: string | null = null
  if (match[7]) tz = 'UTC'
  else if (params.TZID && validZone(params.TZID)) tz = params.TZID
  return { allDay: false, y, m, d, h, mi, tz }
}

function parseDtList(prop: Prop): Dt[] {
  return prop.value
    .split(',')
    .map((part) => parseDt(part, prop.params))
    .filter((dt): dt is Dt => dt !== null)
}

function parseDuration(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  )
  if (!match) return null
  const seconds =
    Number(match[2] ?? 0) * 604800 +
    Number(match[3] ?? 0) * 86400 +
    Number(match[4] ?? 0) * 3600 +
    Number(match[5] ?? 0) * 60 +
    Number(match[6] ?? 0)
  return match[1] === '-' ? -seconds : seconds
}

/* ── repeat rules ──────────────────────────────────────────────────────── */

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: Dt
  byDay: { n: number; wd: number }[]
  byMonthDay: number[]
  byMonth: number[]
  bySetPos: number[]
  wkst: number
  unsupported: boolean
}

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function ints(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n))
}

function parseRule(value: string): Rule {
  const rule: Rule = {
    freq: 'DAILY',
    interval: 1,
    byDay: [],
    byMonthDay: [],
    byMonth: [],
    bySetPos: [],
    wkst: 1,
    unsupported: false,
  }
  for (const part of value.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    const key = part.slice(0, eq).toUpperCase()
    const val = part.slice(eq + 1)
    switch (key) {
      case 'FREQ':
        if (val === 'DAILY' || val === 'WEEKLY' || val === 'MONTHLY' || val === 'YEARLY') {
          rule.freq = val
        } else rule.unsupported = true
        break
      case 'INTERVAL':
        rule.interval = Math.max(1, Number(val) || 1)
        break
      case 'COUNT':
        rule.count = Number(val) > 0 ? Number(val) : undefined
        break
      case 'UNTIL': {
        const until = parseDt(val, {})
        if (until) rule.until = until
        else rule.unsupported = true
        break
      }
      case 'BYDAY':
        for (const token of val.split(',')) {
          const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token.trim().toUpperCase())
          if (match) rule.byDay.push({ n: Number(match[1] ?? 0), wd: WEEKDAYS[match[2]] })
          else rule.unsupported = true
        }
        break
      case 'BYMONTHDAY':
        rule.byMonthDay = ints(val).filter((n) => n !== 0 && Math.abs(n) <= 31)
        break
      case 'BYMONTH':
        rule.byMonth = ints(val).filter((n) => n >= 1 && n <= 12)
        break
      case 'BYSETPOS':
        rule.bySetPos = ints(val).filter((n) => n !== 0)
        break
      case 'WKST':
        if (val in WEEKDAYS) rule.wkst = WEEKDAYS[val]
        break
      case 'BYHOUR':
      case 'BYMINUTE':
      case 'BYSECOND':
      case 'RSCALE':
      case 'SKIP':
        break
      default:
        // BYYEARDAY, BYWEEKNO and anything unknown: not guessed at.
        rule.unsupported = true
    }
  }
  if (rule.freq === 'YEARLY' && rule.byDay.length && !rule.byMonth.length) rule.unsupported = true
  return rule
}

function resolveMonthDays(list: number[], length: number): number[] {
  return list
    .map((n) => (n > 0 ? n : length + 1 + n))
    .filter((n) => n >= 1 && n <= length)
}

function pickPositions(set: number[], positions: number[]): number[] {
  if (!positions.length) return set
  const picked = new Set<number>()
  for (const p of positions) {
    const item = p > 0 ? set[p - 1] : set[set.length + p]
    if (item !== undefined) picked.add(item)
  }
  return [...picked].sort((a, b) => a - b)
}

function monthCandidates(y: number, m: number, rule: Rule, startDay: number): number[] {
  const length = daysIn(y, m)
  let days: number[]
  if (rule.byDay.length) {
    const found = new Set<number>()
    const first = weekday(dayNumber(y, m, 1))
    const last = weekday(dayNumber(y, m, length))
    for (const { n, wd } of rule.byDay) {
      if (n === 0) {
        for (let d = 1; d <= length; d++) if (weekday(dayNumber(y, m, d)) === wd) found.add(d)
      } else if (n > 0) {
        const d = 1 + ((wd - first + 7) % 7) + 7 * (n - 1)
        if (d <= length) found.add(d)
      } else {
        const d = length - ((last - wd + 7) % 7) - 7 * (-n - 1)
        if (d >= 1) found.add(d)
      }
    }
    days = [...found]
    if (rule.byMonthDay.length) {
      const allowed = new Set(resolveMonthDays(rule.byMonthDay, length))
      days = days.filter((d) => allowed.has(d))
    }
  } else if (rule.byMonthDay.length) {
    days = [...new Set(resolveMonthDays(rule.byMonthDay, length))]
  } else {
    days = startDay <= length ? [startDay] : []
  }
  return days.sort((a, b) => a - b).map((d) => dayNumber(y, m, d))
}

/* The day numbers a rule produces, in the event's own frame, from its start up
   to `limit`. COUNT is counted from the start, which is why this always begins
   there. */
function startsOf(
  rule: Rule,
  start: Dt,
  limit: number,
  afterUntil: (n: number) => boolean,
): number[] {
  const startDn = dayNumber(start.y, start.m, start.d)
  const out: number[] = []
  let counted = 0

  const accept = (n: number): boolean => {
    if (n < startDn) return true
    if (afterUntil(n)) return false
    counted++
    if (rule.count !== undefined && counted > rule.count) return false
    if (n > limit) return false
    out.push(n)
    return out.length < 6000
  }

  const periodStart = (k: number): number => {
    switch (rule.freq) {
      case 'DAILY':
        return startDn + k * rule.interval
      case 'WEEKLY':
        return startDn - ((weekday(startDn) - rule.wkst + 7) % 7) + 7 * rule.interval * k
      case 'MONTHLY': {
        const index = start.y * 12 + (start.m - 1) + k * rule.interval
        return dayNumber(Math.floor(index / 12), (index % 12) + 1, 1)
      }
      default:
        return dayNumber(start.y + k * rule.interval, 1, 1)
    }
  }

  const candidates = (k: number): number[] => {
    switch (rule.freq) {
      case 'DAILY': {
        const n = startDn + k * rule.interval
        const { m, d } = ymd(n)
        if (rule.byMonth.length && !rule.byMonth.includes(m)) return []
        if (rule.byMonthDay.length && !resolveMonthDays(rule.byMonthDay, daysIn(ymd(n).y, m)).includes(d)) return []
        if (rule.byDay.length && !rule.byDay.some((b) => b.wd === weekday(n))) return []
        return [n]
      }
      case 'WEEKLY': {
        const first = periodStart(k)
        const wanted = rule.byDay.length ? rule.byDay.map((b) => b.wd) : [weekday(startDn)]
        const days = wanted
          .map((wd) => first + ((wd - rule.wkst + 7) % 7))
          .sort((a, b) => a - b)
        return rule.byMonth.length ? days.filter((n) => rule.byMonth.includes(ymd(n).m)) : days
      }
      case 'MONTHLY': {
        const index = start.y * 12 + (start.m - 1) + k * rule.interval
        const y = Math.floor(index / 12)
        const m = (index % 12) + 1
        if (rule.byMonth.length && !rule.byMonth.includes(m)) return []
        return pickPositions(monthCandidates(y, m, rule, start.d), rule.bySetPos)
      }
      default: {
        const y = start.y + k * rule.interval
        const months = rule.byMonth.length ? rule.byMonth : [start.m]
        const merged = months
          .flatMap((m) => monthCandidates(y, m, rule, start.d))
          .sort((a, b) => a - b)
        return pickPositions(merged, rule.bySetPos)
      }
    }
  }

  for (let k = 0; k < 20000; k++) {
    if (periodStart(k) > limit) break
    for (const n of candidates(k)) if (!accept(n)) return out
  }
  return out
}

/* ── events ────────────────────────────────────────────────────────────── */

interface Raw {
  uid: string
  title: string
  location: string
  note: string
  start: Dt
  end: Dt | null
  durationSeconds: number | null
  rule: Rule | null
  exdates: Dt[]
  rdates: Dt[]
  recurrenceId: Dt | null
  cancelled: boolean
}

function toRaw(props: Prop[]): Raw | null {
  const get = (name: string) => props.find((p) => p.name === name)
  const all = (name: string) => props.filter((p) => p.name === name)
  const startProp = get('DTSTART')
  const start = startProp ? parseDt(startProp.value, startProp.params) : null
  if (!start) return null
  const endProp = get('DTEND')
  const durationProp = get('DURATION')
  const ridProp = get('RECURRENCE-ID')
  const ruleProp = get('RRULE')
  const title = clean(get('SUMMARY')?.value, 300)
  const uid =
    clean(get('UID')?.value, 400) ||
    `anon-${title}-${start.y}${pad(start.m)}${pad(start.d)}${pad(start.h)}${pad(start.mi)}`
  return {
    uid,
    title: title || '(No title)',
    location: clean(get('LOCATION')?.value, 300).replace(/\s*\n+\s*/g, ', '),
    note: clean(get('DESCRIPTION')?.value, 2000),
    start,
    end: endProp ? parseDt(endProp.value, endProp.params) : null,
    durationSeconds: durationProp ? parseDuration(durationProp.value) : null,
    rule: ruleProp ? parseRule(ruleProp.value) : null,
    exdates: all('EXDATE').flatMap(parseDtList),
    rdates: all('RDATE').flatMap(parseDtList),
    recurrenceId: ridProp ? parseDt(ridProp.value, ridProp.params) : null,
    cancelled: (get('STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED',
  }
}

const wallOfDt = (dt: Dt): Wall => ({ y: dt.y, m: dt.m, d: dt.d, h: dt.h, mi: dt.mi, s: 0 })

/* Two spellings of "which occurrence", so a date-only exclusion still finds a
   timed occurrence and an exact instant finds an exact one. */
function keysOfDt(dt: Dt, fallbackZone: string | null, target: string): string[] {
  if (dt.allDay) return [`d${dayNumber(dt.y, dt.m, dt.d)}`]
  return [`t${instantOf(wallOfDt(dt), dt.tz ?? fallbackZone ?? target)}`]
}

function span(raw: Raw, target: string): { days: number; ms: number } {
  if (raw.start.allDay) {
    const startDn = dayNumber(raw.start.y, raw.start.m, raw.start.d)
    if (raw.end) return { days: Math.max(1, dayNumber(raw.end.y, raw.end.m, raw.end.d) - startDn), ms: 0 }
    if (raw.durationSeconds !== null) {
      return { days: Math.max(1, Math.ceil(raw.durationSeconds / 86400)), ms: 0 }
    }
    return { days: 1, ms: 0 }
  }
  const zone = raw.start.tz ?? target
  if (raw.end && !raw.end.allDay) {
    const startMs = instantOf(wallOfDt(raw.start), zone)
    const endMs = instantOf(wallOfDt(raw.end), raw.end.tz ?? raw.start.tz ?? target)
    return { days: 1, ms: Math.max(0, endMs - startMs) }
  }
  if (raw.durationSeconds !== null) return { days: 1, ms: Math.max(0, raw.durationSeconds * 1000) }
  return { days: 1, ms: 0 }
}

export function expandIcs(
  source: string,
  from: string,
  to: string,
  target: string,
  max = 3000,
): ExpandResult {
  const { blocks, calendar } = collect(source)
  const toDn = isoToDayNumber(to)
  const raws: Raw[] = []
  for (const block of blocks) {
    const raw = toRaw(block)
    if (raw) raws.push(raw)
  }

  // Single-instance edits replace the occurrence they name.
  const replaced = new Set<string>()
  for (const raw of raws) {
    if (!raw.recurrenceId) continue
    for (const key of keysOfDt(raw.recurrenceId, raw.start.tz, target)) {
      replaced.add(`${raw.uid}|${key}`)
    }
  }

  const found = new Map<string, AppleEvent>()
  let skipped = 0

  for (const raw of raws) {
    if (raw.cancelled) continue
    const size = span(raw, target)
    const zone = raw.start.tz ?? target
    const excluded = new Set<string>()
    for (const dt of raw.exdates) for (const key of keysOfDt(dt, raw.start.tz, target)) excluded.add(key)

    const emit = (n: number, h: number, mi: number) => {
      const occurrenceKeys = raw.start.allDay
        ? [`d${n}`]
        : [`d${n}`, `t${instantOf({ ...ymd(n), h, mi, s: 0 }, zone)}`]
      if (occurrenceKeys.some((key) => excluded.has(key))) return
      if (!raw.recurrenceId && occurrenceKeys.some((key) => replaced.has(`${raw.uid}|${key}`))) return
      const event = place(raw, n, h, mi, size, target)
      if (!event) return
      if (event.date > to || (event.endDate ?? event.date) < from) return
      found.set(event.id, event)
    }

    const startDn = dayNumber(raw.start.y, raw.start.m, raw.start.d)
    let starts: number[]
    if (raw.rule && !raw.recurrenceId) {
      if (raw.rule.unsupported) {
        skipped++
        starts = [startDn]
      } else {
        const rule = raw.rule
        const untilDn = rule.until ? dayNumber(rule.until.y, rule.until.m, rule.until.d) : 0
        const afterUntil = (n: number): boolean => {
          const until = rule.until
          if (!until) return false
          if (n < untilDn - 1) return false
          if (n > untilDn + 1) return true
          if (until.allDay || raw.start.allDay) return n > untilDn
          const wall = { ...ymd(n), h: raw.start.h, mi: raw.start.mi, s: 0 }
          if (until.tz) {
            return instantOf(wall, zone) > instantOf(wallOfDt(until), until.tz)
          }
          return asUtc(wall) > asUtc({ ...wallOfDt(until), s: 0 })
        }
        starts = startsOf(rule, raw.start, toDn + 3, afterUntil)
      }
    } else starts = [startDn]

    for (const n of starts) emit(n, raw.start.h, raw.start.mi)
    if (!raw.recurrenceId) {
      for (const dt of raw.rdates) emit(dayNumber(dt.y, dt.m, dt.d), dt.h, dt.mi)
    }
  }

  const events = [...found.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.localeCompare(b.title),
  )
  const truncated = events.length > max
  const name = clean(calendar['X-WR-CALNAME'], 120)
  return {
    ...(name ? { calendarName: name } : {}),
    events: truncated ? events.slice(0, max) : events,
    skipped,
    truncated,
  }
}

/* One occurrence, as the viewer sees it. */
function place(
  raw: Raw,
  n: number,
  h: number,
  mi: number,
  size: { days: number; ms: number },
  target: string,
): AppleEvent | null {
  const detail = {
    ...(raw.location ? { location: raw.location } : {}),
    ...(raw.note ? { note: raw.note } : {}),
  }

  if (raw.start.allDay) {
    const date = iso(n)
    const last = size.days > 1 ? iso(n + size.days - 1) : undefined
    return {
      id: `${raw.uid}#${date}`,
      title: raw.title,
      date,
      ...(last ? { endDate: last } : {}),
      allDay: true,
      ...detail,
    }
  }

  const zone = raw.start.tz ?? target
  const startMs = instantOf({ ...ymd(n), h, mi, s: 0 }, zone)
  const startWall = wallOf(startMs, target)
  const date = isoWall(startWall)
  let endDate: string | undefined
  let endTime: string | undefined
  if (size.ms > 0) {
    const endWall = wallOf(startMs + size.ms, target)
    const endDay = isoWall(endWall)
    if (endDay === date) endTime = hhmm(endWall)
    else if (endWall.h === 0 && endWall.mi === 0) {
      // Ends at midnight: the last day it occupies is the one before.
      const previous = iso(dayNumber(endWall.y, endWall.m, endWall.d) - 1)
      if (previous > date) endDate = previous
    } else {
      endDate = endDay
      endTime = hhmm(endWall)
    }
  }
  return {
    id: `${raw.uid}#${startMs}`,
    title: raw.title,
    date,
    ...(endDate ? { endDate } : {}),
    startTime: hhmm(startWall),
    ...(endTime ? { endTime } : {}),
    allDay: false,
    ...detail,
  }
}
