import { useSyncExternalStore } from 'react'
import type { Pen, Stock } from './model'

/* App preferences, not writing. They live in localStorage rather than Dexie
   for one reason: reading them is synchronous, so the first paint is already
   the right stock. A page that flashes cream before going dark is worse than
   a slightly less tidy store. */

export interface Settings {
  pen: Pen
  stock: Stock
  /* Whether the docked sidebar is showing. Only consulted where there's room
     to dock one; on a tablet the sidebar is a tap away, not a preference. */
  sidebar: boolean
}

const KEY = 'field-notes.settings'
const FALLBACK: Settings = { pen: 'ink', stock: 'paper', sidebar: true }

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return FALLBACK
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      pen: parsed.pen === 'felt' ? 'felt' : 'ink',
      stock: parsed.stock === 'night' ? 'night' : 'paper',
      sidebar: parsed.sidebar !== false,
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
