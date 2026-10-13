import { useEffect, useSyncExternalStore } from 'react'
import { shiftDate } from '../lib/event-recurrence'
import { isoDay } from '../lib/format'
import type { FieldEvent } from '../lib/model'
import { getVault, useVault } from '../sync/vault'
import { decodeApple, type AppleSnapshot } from './wire'

/* Apple Calendar, shown beside Field Notes' own events and never merged into
   them. The events come from the apple-calendar Edge Function, which reads a
   published iCloud feed. Read only, in memory, and keyed to the paired vault:
   unpairing clears them, and an event never becomes a note unless Joshua
   writes one himself. */

export type AppleStatus =
  | 'setup' // this device isn't paired, so there is no key to ask with
  | 'loading'
  | 'ready'
  | 'stale' // a refresh failed; showing the last copy
  | 'offline'
  | 'unavailable' // the server has no feed address yet
  | 'denied' // the server didn't accept this device's key
  | 'error'

export interface AppleState {
  status: AppleStatus
  snapshot?: AppleSnapshot
}

export type AppleCalendarEvent = FieldEvent & { externalSource: 'apple'; stale?: boolean }

const FUNCTION_PATH = '/functions/v1/apple-calendar'
const PAD_BEFORE = 60
const PAD_AFTER = 120
const MAX_WINDOW = 399
const zoneNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function daysBetween(a: string, b: string): number {
  return Math.round((+new Date(`${b}T12:00:00Z`) - +new Date(`${a}T12:00:00Z`)) / 86_400_000)
}

/* The window actually fetched for the days asked about: padded, so that
   paging a month or two either way doesn't ask again. */
export function windowFor(from: string, to: string): { from: string; to: string } {
  const start = shiftDate(from, -PAD_BEFORE)
  const end = shiftDate(to, PAD_AFTER)
  return { from: start, to: daysBetween(start, end) > MAX_WINDOW ? shiftDate(start, MAX_WINDOW) : end }
}

interface Loaded {
  window: { from: string; to: string }
  asked: { from: string; to: string }
  zone: string
  vault: string
}

export function createAppleStore(
  fetcher: typeof fetch = (...args) => fetch(...args),
  vaultOf: typeof getVault = getVault,
  zone: () => string = zoneNow,
) {
  let state: AppleState = { status: vaultOf() ? 'loading' : 'setup' }
  let loaded: Loaded | null = null // what the snapshot on screen covers
  let pending: (Loaded & { promise: Promise<void> }) | null = null
  let generation = 0
  let blocked = '' // a vault the server turned away or has no feed for; retried by refresh()
  let controller: AbortController | undefined
  const listeners = new Set<() => void>()
  const publish = (next: AppleState) => {
    state = next
    for (const fn of listeners) fn()
  }

  const clear = (status: AppleStatus) => {
    generation++
    controller?.abort()
    controller = undefined
    loaded = null
    pending = null
    publish({ status })
  }

  const covers = (have: Loaded | null, vault: string, from: string, to: string) =>
    !!have && have.vault === vault && have.zone === zone() && have.window.from <= from && have.window.to >= to

  function load(from: string, to: string, quiet: boolean): Promise<void> {
    const vault = vaultOf()
    if (!vault) {
      clear('setup')
      return Promise.resolve()
    }
    if (loaded && loaded.vault !== vault.id) {
      // A different vault never inherits the last one's events.
      loaded = null
      publish({ status: 'loading' })
    }
    const window_ = windowFor(from, to)
    const target: Loaded = { window: window_, asked: { from, to }, zone: zone(), vault: vault.id }
    const epoch = ++generation
    controller?.abort()
    controller = new AbortController()
    const mine = controller
    const previous = state.snapshot

    const run = async () => {
      if (!navigator.onLine) {
        publish({ status: 'offline', ...(previous ? { snapshot: previous } : {}) })
        return
      }
      if (!previous && !quiet) publish({ status: 'loading' })
      const timeout = globalThis.setTimeout(() => mine.abort(), 20_000)
      try {
        const url = new URL(`${vault.url.replace(/\/+$/, '')}${FUNCTION_PATH}`)
        url.searchParams.set('from', window_.from)
        url.searchParams.set('to', window_.to)
        url.searchParams.set('tz', target.zone)
        const response = await fetcher(url, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'omit',
          signal: mine.signal,
          headers: {
            apikey: vault.anonKey,
            Authorization: `Bearer ${vault.anonKey}`,
            'x-vault-key': vault.key,
          },
        })
        if (epoch !== generation) return
        if (response.status === 401 || response.status === 403) {
          clear('denied')
          blocked = target.vault
          return
        }
        if (response.status === 503) {
          loaded = null
          blocked = target.vault
          publish({ status: 'unavailable' })
          return
        }
        if (!response.ok) throw new Error(`Apple Calendar answered ${response.status}`)
        const body = await response.text()
        if (body.length > 2_000_000) throw new Error('Apple Calendar response exceeds its size limit')
        const snapshot = decodeApple(JSON.parse(body), window_, target.zone)
        if (epoch !== generation) return
        loaded = target
        publish({ status: 'ready', snapshot })
      } catch {
        if (epoch !== generation) return
        publish(
          !navigator.onLine
            ? { status: 'offline', ...(previous ? { snapshot: previous } : {}) }
            : previous
              ? { status: 'stale', snapshot: previous }
              : { status: 'error' },
        )
      } finally {
        globalThis.clearTimeout(timeout)
        if (pending && epoch === generation) pending = null
      }
    }
    const promise = run()
    pending = { ...target, promise }
    return promise
  }

  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    /* Make sure the days asked about are loaded. Cheap to call: when they
       already are, or are on their way, it does nothing. */
    ensure(from: string, to: string): Promise<void> {
      const vault = vaultOf()
      if (!vault) {
        if (state.status !== 'setup') clear('setup')
        return Promise.resolve()
      }
      if (state.status === 'ready' && covers(loaded, vault.id, from, to)) return Promise.resolve()
      if (pending && covers(pending, vault.id, from, to)) return pending.promise
      // A server that says it isn't set up, or doesn't accept this key, won't change
      // by asking on every render; the scheduled refresh and Settings try again.
      if (blocked === vault.id) return Promise.resolve()
      return load(from, to, false)
    },
    /* Fetch again, for the days already on screen or else around today. */
    refresh(): Promise<void> {
      const today = isoDay()
      const asked = pending?.asked ?? loaded?.asked ?? { from: today, to: today }
      blocked = ''
      return load(asked.from, asked.to, true)
    },
    disconnect: () => clear('setup'),
  }
}

export const appleCalendar = createAppleStore()

export function appleEvents(state: AppleState, from?: string, to?: string): AppleCalendarEvent[] {
  const snapshot = state.snapshot
  if (!snapshot) return []
  const stale = state.status !== 'ready' || snapshot.stale
  return snapshot.events
    .filter((e) => !from || !to || (e.date <= to && (e.endDate ?? e.date) >= from))
    .map((e) => ({
      id: `apple:${e.id}`,
      title: e.title,
      date: e.date,
      ...(e.endDate ? { endDate: e.endDate } : {}),
      ...(e.startTime ? { startTime: e.startTime } : {}),
      ...(e.endTime ? { endTime: e.endTime } : {}),
      ...(e.location ? { location: e.location } : {}),
      ...(e.note ? { note: e.note } : {}),
      created: 0,
      updated: 0,
      externalSource: 'apple' as const,
      stale,
    }))
}

/* Subscribes, and makes sure the days this screen shows are loaded. */
export function useAppleCalendar(from?: string, to?: string): AppleState {
  const vault = useVault()
  const state = useSyncExternalStore(appleCalendar.subscribe, appleCalendar.getSnapshot)
  useEffect(() => {
    if (from && to) void appleCalendar.ensure(from, to)
  }, [from, to, vault?.id])
  return state
}

/* Once for the app: load around today, then keep it fresh while it's open. */
export function useAppleRefresh() {
  const vault = useVault()
  useEffect(() => {
    const today = isoDay()
    void appleCalendar.ensure(today, today)
    const refresh = () => {
      if (document.visibilityState === 'visible' && getVault()) void appleCalendar.refresh()
    }
    const timer = window.setInterval(refresh, 10 * 60_000)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [vault?.id])
}
