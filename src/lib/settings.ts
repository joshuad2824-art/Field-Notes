import { useSyncExternalStore } from 'react'
import type { Pen, Stock } from './model'

/* App preferences, not writing. They live in localStorage rather than Dexie
   for one reason: reading them is synchronous, so the first paint is already
   the right stock. A page that flashes cream before going dark is worse than
   a slightly less tidy store. */

export interface Settings {
  pen: Pen
  stock: Stock
  /* The two docked columns, each folded on its own — notebooks, and the pages
     in one. Only consulted where there's room to dock them; below 1120 the
     list is the whole window and the rail is a drawer, so neither is a
     preference there. */
  rail: boolean
  list: boolean
  /* The notebook the app opens into. */
  notebook: string
  /* How large the writing is drawn. Two jobs since August 2026: stepping a
     page up for a room, and — through its first-run default below — the
     device's reading size. The type and the 28px grid scale together, so the
     dots stay under the lines at every step. */
  zoom: number
}

/* Quarters, and nothing between them — because 28 × the zoom has to come out
   a whole number of pixels. At 1.3 the line box is 36.4px, the browser rounds
   it to 36, and the dot grid walks out from under the writing a third of a
   pixel a line. These five give 28, 35, 42, 49 and 56, and every heading at
   twice that. */
export const ZOOMS = [1, 1.25, 1.5, 1.75, 2] as const

const KEY = 'field-notes.settings'
const DEFAULTED_KEY = 'field-notes.zoom-defaulted'
const FALLBACK: Settings = {
  pen: 'ink',
  stock: 'paper',
  rail: true,
  list: true,
  notebook: 'field-notes',
  zoom: 1,
}

/* What the dial opens at, by device class. Spectral 17 at arm's length on a
   phone sits in the recommended legibility band; at a laptop's distance it is
   below the ISO minimum, and the dial is the only mechanism that can fix that
   without breaking the grid — a second, independent base size would multiply
   against the dial's quarters and walk the dots out from under the writing.
   So decision 6's control now does two jobs, and the amendment is recorded
   there. A finger on the screen is a tablet or a phone, told apart by the
   screen's short side; anything else is a desk. */
function deviceZoom(): number {
  try {
    if (!window.matchMedia('(pointer: coarse)').matches) return 1.5
    return Math.min(window.screen.width, window.screen.height) >= 600 ? 1.25 : 1
  } catch {
    return 1
  }
}

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Partial<Settings> & { sidebar?: boolean })
      : ({} as Partial<Settings> & { sidebar?: boolean })
    /* The two columns were one flag until they learned to fold separately. */
    const both = parsed.sidebar !== false
    const settings: Settings = {
      pen: parsed.pen === 'felt' ? 'felt' : 'ink',
      stock: parsed.stock === 'night' ? 'night' : 'paper',
      rail: parsed.rail ?? both,
      list: parsed.list ?? both,
      notebook: typeof parsed.notebook === 'string' ? parsed.notebook : FALLBACK.notebook,
      zoom: ZOOMS.includes(parsed.zoom as (typeof ZOOMS)[number]) ? (parsed.zoom as number) : 1,
    }
    /* Once per device, first boot after this shipped: a stored zoom of 1
       cannot have been deliberate, because 1 was the only value a device ever
       started at — so it takes the device default, and the marker is what
       makes a later, deliberate return to 1 stick. */
    if (!localStorage.getItem(DEFAULTED_KEY)) {
      if (settings.zoom === 1) settings.zoom = deviceZoom()
      localStorage.setItem(DEFAULTED_KEY, '1')
    }
    return settings
  } catch {
    return FALLBACK
  }
}

export function getSettings(): Settings {
  return current
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* a full or blocked store is not a reason to stop working */
  }
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

/* One step in or out, stopping at the ends rather than wrapping round. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const at = ZOOMS.indexOf(current as (typeof ZOOMS)[number])
  const from = at === -1 ? 0 : at
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, from + direction))]
}
