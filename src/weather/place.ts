import { useSyncExternalStore } from 'react'

/* Where the weather is being asked about.

   Settings can request this device's location or choose a named place. Both
   are saved here. Routine weather refreshes reuse that saved place and never
   request device location: browser permission can expire between launches,
   and only an explicit Settings action should be able to raise its prompt. */

export interface Place {
  lat: number
  lon: number
  /* What to call it. Absent when the device placed itself — a set of
     coordinates has no name worth showing, and the weather line is not the
     place to put one. */
  label?: string
  /* True when this came from a Settings entry rather than the device, which is
     what stops geolocation quietly overriding a deliberate choice. */
  chosen?: boolean
}

const KEY = 'field-notes.place'
const REFUSED = 'field-notes.place.refused'

let current: Place | null = read()
const listeners = new Set<() => void>()

function read(): Place | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Place>
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null
    return { lat: p.lat, lon: p.lon, label: p.label, chosen: p.chosen }
  } catch {
    return null
  }
}

export function getPlace(): Place | null {
  return current
}

export function setPlace(place: Place | null): void {
  current = place
  try {
    if (place) localStorage.setItem(KEY, JSON.stringify(place))
    else localStorage.removeItem(KEY)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  for (const fn of listeners) fn()
}

function refused(): boolean {
  try {
    return localStorage.getItem(REFUSED) === '1'
  } catch {
    return false
  }
}

function rememberRefusal(): void {
  try {
    localStorage.setItem(REFUSED, '1')
  } catch {
    /* nothing here is worth failing over */
  }
}

/* Clears the refusal too, so "ask me again" is a thing Settings can offer. */
export function forgetRefusal(): void {
  try {
    localStorage.removeItem(REFUSED)
  } catch {
    /* nothing here is worth failing over */
  }
}

export function wasRefused(): boolean {
  return refused()
}

/* Ask the device from an explicit Settings action. Resolves to null rather than throwing, because there
   is no caller who wants to handle "the user said no" as an exception. */
export function locate(timeout = 8000): Promise<Place | null> {
  if (!navigator.geolocation || refused()) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const done = (place: Place | null) => {
      if (settled) return
      settled = true
      resolve(place)
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => done({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (error) => {
        /* 1 is PERMISSION_DENIED. A timeout or a device that simply cannot
           place itself today is not a refusal and is worth trying again. */
        if (error.code === 1) rememberRefusal()
        done(null)
      },
      { timeout, maximumAge: 30 * 60 * 1000, enableHighAccuracy: false },
    )
    setTimeout(() => done(null), timeout + 500)
  })
}

/* Reuse the saved place, including previously saved device coordinates.
   Weather can refresh without asking where the device is again. */
export async function resolvePlace(): Promise<Place | null> {
  return current
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function usePlace(): Place | null {
  return useSyncExternalStore(subscribe, getPlace, getPlace)
}
