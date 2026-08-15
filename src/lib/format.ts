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
