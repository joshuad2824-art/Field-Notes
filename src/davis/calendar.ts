import { expandEvents } from '../lib/event-recurrence'
import { useEffect, useSyncExternalStore } from 'react'
import { davisAgenda, type AgendaState } from './agenda'
import type { FieldEvent } from '../lib/model'
export type CalendarEvent = FieldEvent & { externalSource?: 'davis'; stale?: boolean }
export function familyEvents(state: AgendaState): CalendarEvent[] {
  return (state.snapshot?.entries ?? []).filter(entry => entry.kind === 'event').map(entry => ({
    id: `davis:${entry.sourceId}`, title: entry.title, date: entry.startDate, endDate: entry.endDate,
    startTime: entry.time, location: entry.location, note: entry.note, created: 0, updated: 0,
    externalSource: 'davis', stale: state.status !== 'ready',
  }))
}
export function mergeCalendarEvents(local: FieldEvent[], state: AgendaState, from?: string, to?: string): CalendarEvent[] {
  return [...(from && to ? expandEvents(local, from, to) : local), ...familyEvents(state)].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title))
}
export function useFamilyAgenda() { return useSyncExternalStore(davisAgenda.subscribe, davisAgenda.getSnapshot) }
export function useFamilyRefresh() {
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && davisAgenda.getSnapshot().snapshot) void davisAgenda.refresh() }
    const timer = window.setInterval(refresh, 5 * 60_000)
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
}
