import type { FieldEvent } from './model'

/* The countdown tile on Today: the next timed event in the coming fortnight,
   from the same merged list the schedule reads (recurrences expanded, Davis
   events included). No clock and no Dexie in here, so it reads on node. */
export function nextTimed<E extends Pick<FieldEvent, 'date' | 'startTime'>>(
  events: E[],
  now: number,
  days = 14,
): { event: E; at: number } | null {
  const until = now + days * 86_400_000
  let best: { event: E; at: number } | null = null
  for (const event of events) {
    if (!event.startTime || !/^\d{2}:\d{2}/.test(event.startTime)) continue
    const at = new Date(`${event.date}T${event.startTime.slice(0, 5)}:00`).getTime()
    if (!(at > now) || at > until) continue
    if (!best || at < best.at) best = { event, at }
  }
  return best
}

const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/* "4 days, 16 hrs" a day or more out; "3 hrs, 20 min" inside a day. */
export function countdownLabel(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60
  if (days >= 1) return hours ? `${unit(days, 'day', 'days')}, ${unit(hours, 'hr', 'hrs')}` : unit(days, 'day', 'days')
  if (hours >= 1) return `${unit(hours, 'hr', 'hrs')}, ${mins} min`
  return `${mins} min`
}
