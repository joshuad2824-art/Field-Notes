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
  /* How large the writing is drawn. Not a browser zoom and not a preference
     about eyesight — it is for standing a page on a big screen in front of a
     room. The type and the 28px grid scale together, so the dots stay under
     the lines at every step. */
  zoom: number
}

/* Quarters, and nothing between them — because 28 × the zoom has to come out
   a whole number of pixels. At 1.3 the line box is 36.4px, the browser rounds
   it to 36, and the dot grid walks out from under the writing a third of a
   pixel a line. These five give 28, 35, 42, 49 and 56, and every heading at
   twice that. */
export const ZOOMS = [1, 1.25, 1.5, 1.75, 2] as const

const KEY = 'field-notes.settings'
const FALLBACK: Settings = {
  pen: 'ink',
  stock: 'paper',
  rail: true,
  list: true,
  notebook: 'field-notes',
  zoom: 1,
}

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return FALLBACK
    const parsed = JSON.parse(raw) as Partial<Settings> & { sidebar?: boolean }
    /* The two columns were one flag until they learned to fold separately. */
    const both = parsed.sidebar !== false
    return {
      pen: parsed.pen === 'felt' ? 'felt' : 'ink',
      stock: parsed.stock === 'night' ? 'night' : 'paper',
      rail: parsed.rail ?? both,
      list: parsed.list ?? both,
      notebook: typeof parsed.notebook === 'string' ? parsed.notebook : FALLBACK.notebook,
      zoom: ZOOMS.includes(parsed.zoom as (typeof ZOOMS)[number]) ? (parsed.zoom as number) : 1,
    }
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
