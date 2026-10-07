import { useSyncExternalStore } from 'react'
import { monthNow, stepMonth } from './calendar'
import { isoDay } from './format'

// Navigation state only. Calendar marks still come from original pages/events.
let view = { month: monthNow(), selected: isoDay() }
const listeners = new Set<() => void>()
export function selectCalendarDate(selected: string) {
  view = { month: selected.slice(0, 7), selected }
  listeners.forEach(fn => fn())
}
export function showCalendarMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || view.month === month) return
  const [year, number] = month.split('-').map(Number)
  const day = Math.min(Number(view.selected.slice(8)), new Date(year, number, 0).getDate())
  view = { month, selected: `${month}-${String(day).padStart(2, '0')}` }
  listeners.forEach(fn => fn())
}
export function stepCalendarMonth(by: number) { showCalendarMonth(stepMonth(view.month, by)) }
export function useCalendarView() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => view)
}
