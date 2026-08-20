import { useSyncExternalStore } from 'react'
import { forecast, type Reading, type Unit } from './open-meteo'
import { resolvePlace } from './place'

/* What the chrome reads, and the schedule behind it.

   The last reading is kept in localStorage and shown immediately, stale or
   not. Weather that flickers in half a second after every open would be worse
   than weather that is twenty minutes old, and a reading from this morning is
   still roughly true — which is more than can be said for an empty line.

   Nothing here ever blocks anything. If the fetch fails the old reading stays
   and no one is told; there is no error state, because a failed weather lookup
   is not news. */

const KEY = 'field-notes.weather'
const UNIT = 'field-notes.weather.unit'
const OFF = 'field-notes.weather.off'
const STALE = 20 * 60 * 1000

/* Where a degree means Fahrenheit. Everywhere else it means Celsius, and this
   is a default rather than a decision — Settings overrides it. */
const FAHRENHEIT = new Set(['US', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH', 'LR'])

function localeUnit(): Unit {
  try {
    const region = new Intl.Locale(navigator.language).region
    return region && FAHRENHEIT.has(region) ? 'F' : 'C'
  } catch {
    return 'C'
  }
}

function readUnit(): Unit {
  try {
    const saved = localStorage.getItem(UNIT)
    if (saved === 'C' || saved === 'F') return saved
  } catch {
    /* fall through to the locale's own answer */
  }
  return localeUnit()
}

function readReading(): Reading | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<Reading>
    if (typeof r.temp !== 'number' || typeof r.code !== 'number') return null
    return {
      temp: r.temp,
      code: r.code,
      high: typeof r.high === 'number' ? r.high : r.temp,
      low: typeof r.low === 'number' ? r.low : r.temp,
      unit: r.unit === 'F' ? 'F' : 'C',
      at: typeof r.at === 'number' ? r.at : 0,
    }
  } catch {
    return null
  }
}

function readOff(): boolean {
  try {
    return localStorage.getItem(OFF) === '1'
  } catch {
    return false
  }
}

let reading: Reading | null = readReading()
let unit: Unit = readUnit()
let off = readOff()
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function getReading(): Reading | null {
  return off ? null : reading
}

export function getUnit(): Unit {
  return unit
}

export function isOff(): boolean {
  return off
}

export function setOff(value: boolean): void {
  off = value
  try {
    if (value) localStorage.setItem(OFF, '1')
    else localStorage.removeItem(OFF)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  emit()
  if (!value) void refresh(true)
}

export function setUnit(next: Unit): void {
  if (next === unit) return
  unit = next
  try {
    localStorage.setItem(UNIT, next)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  /* The old reading is in the old scale, so it is no longer true. Drop it
     rather than convert it — a conversion here would be a second place that
     knows what a degree is. */
  reading = null
  emit()
  void refresh(true)
}

/* `force` skips the staleness check — for a unit change, or a Settings button
   that ought to do something visible when pressed. */
export async function refresh(force = false): Promise<void> {
  if (off) return
  if (inFlight) return inFlight
  if (!force && reading && Date.now() - reading.at < STALE) return

  inFlight = (async () => {
    try {
      const place = await resolvePlace()
      if (!place) return
      const next = await forecast(place, unit)
      if (!next) return
      reading = next
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* the reading is still good in memory */
      }
      emit()
    } catch {
      /* A failed weather lookup is not news. The old reading stands. */
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/* Started after the first paint, alongside sync, and on the same two signals:
   coming back to the app, and the network returning. */
export function startWeather(): void {
  void refresh()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh()
  })
  window.addEventListener('online', () => void refresh(true))
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useWeather(): Reading | null {
  return useSyncExternalStore(subscribe, getReading, getReading)
}

export type { Reading, Unit }
