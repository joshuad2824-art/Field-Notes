import { useEffect, useState } from 'react'
import { useVault } from '../sync/vault'
import { livePages } from '../lib/db'
import { liveEvents } from '../lib/events'
import { useLive } from '../lib/useLive'
import { monthOf, stepMonth } from '../lib/calendar'
import { isoDay } from '../lib/format'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { useAppleCalendar } from '../apple/calendar'
import { useWorkCalendar } from '../work-calendar/calendar'
import { useSyncStatus } from '../sync/status'
import { calendarProjection, type SourceStatus } from './projection'
import { useWidgetConnection, publishWidget } from './connection'

// The opt-in publisher is mounted only while a device has an active connection.
// One wider source window supports a month rollover while the app is closed.
export function useWidgetProjection(enabled = true) {
  const [month, setMonth] = useState(() => isoDay().slice(0, 7))
  useEffect(() => { const timer = setInterval(() => setMonth(isoDay().slice(0, 7)), 60000); return () => clearInterval(timer) }, [])
  const from = monthOf(stepMonth(month, -1))[0].iso
  const to = monthOf(stepMonth(month, 1))[41].iso
  const pages = useLive(() => enabled ? livePages() : Promise.resolve(null), [enabled], null)
  const events = useLive(() => enabled ? liveEvents() : Promise.resolve(null), [enabled], null)
  const family = useFamilyAgenda()
  const apple = useAppleCalendar(enabled ? from : undefined, enabled ? to : undefined)
  const work = useWorkCalendar(enabled ? from : undefined, enabled ? to : undefined)
  const sync = useSyncStatus()
  if (!enabled || !pages || !events || sync.state === 'syncing') return null
  const coverage = (source: { status: SourceStatus; snapshot?: { from?: string; to?: string } }): SourceStatus =>
    source.status === 'ready' && (!source.snapshot?.from || !source.snapshot.to || source.snapshot.from > from || source.snapshot.to < to)
      ? 'stale' as const : source.status
  return calendarProjection(pages, mergeCalendarEvents(events, family, from, to, apple, work), from, to,
    { davis: coverage(family), apple: coverage(apple), work: coverage(work) }, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
}

function ActivePublisher() {
  const snapshot = useWidgetProjection()
  const serialized = snapshot ? JSON.stringify(snapshot) : ''
  useEffect(() => {
    if (!serialized) return
    const send = () => { if (document.visibilityState === 'visible' && navigator.onLine) void publishWidget(JSON.parse(serialized)).catch(() => {}) }
    const timer = setTimeout(send, 1500)
    const interval = setInterval(send, 5 * 60000)
    window.addEventListener('online', send)
    document.addEventListener('visibilitychange', send)
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener('online', send); document.removeEventListener('visibilitychange', send) }
  }, [serialized])
  return null
}

export function WidgetPublisher() {
  const vault = useVault(), connection = useWidgetConnection()
  return vault && connection?.updated ? <ActivePublisher key={`${vault.id}:${connection.hash}`} /> : null
}
