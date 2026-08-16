/* Metadata is Courier, tracked, uppercase — the field-note register. These
   helpers produce the text; the casing is CSS's job. */

const time = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat([], { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat([], {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const weekday = new Intl.DateTimeFormat([], {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function shortStamp(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (sameDay(d, now)) return time.format(d)
  if (d.getFullYear() === now.getFullYear()) return dayMonth.format(d)
  return dayMonthYear.format(d)
}

export function editedStamp(ts: number): string {
  return `edited ${shortStamp(ts)}`
}

export function todayLine(): string {
  return weekday.format(new Date())
}

export function isoDay(ts: number = Date.now()): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function readableDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return dayMonthYear.format(new Date(y, m - 1, d))
}

export function countLabel(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/* ── the list's date groups ────────────────────────────────────────────
   Pinned, Today, Yesterday, This week, then the day itself. */

const dayMonthShort = new Intl.DateTimeFormat([], { day: 'numeric', month: 'short' })

export function groupFor(ts: number): string {
  const then = new Date(ts)
  const now = new Date()
  if (sameDay(then, now)) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(then, yesterday)) return 'Yesterday'

  const week = new Date(now)
  week.setDate(now.getDate() - 7)
  if (ts > week.getTime()) return 'This week'

  return dayMonthShort.format(then)
}

/* Sunday-first, the week the given day sits in. */
export function weekOf(ts: number = Date.now()): Date[] {
  const start = new Date(ts)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function isToday(day: Date): boolean {
  return sameDay(day, new Date())
}

const weekdayLong = new Intl.DateTimeFormat([], { weekday: 'long' })
const monthLong = new Intl.DateTimeFormat([], { month: 'long' })

export function mastheadParts(now = new Date()) {
  return {
    weekday: weekdayLong.format(now),
    day: String(now.getDate()),
    month: monthLong.format(now),
    year: String(now.getFullYear()),
  }
}
