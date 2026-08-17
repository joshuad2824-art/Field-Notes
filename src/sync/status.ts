import { useSyncExternalStore } from 'react'

/* What sync is doing, for the one small quiet place it is allowed to say so.
   Never a modal, never a blocker, never anything that stands between the tap
   and the text. Its own module with no network in it, so the rail can read the
   state without pulling the transport into the first paint. */

export type SyncState =
  /* no vault on this device — sync was never set up, and nothing is wrong */
  | 'off'
  | 'syncing'
  | 'idle'
  /* the mirror didn't answer. Not an error; a thing that passes. */
  | 'offline'
  | 'error'

export interface Status {
  state: SyncState
  lastSyncedAt: number | null
  error: string | null
}

const LAST = 'field-notes.sync.last'

function readLast(): number | null {
  try {
    const raw = localStorage.getItem(LAST)
    return raw ? Number(raw) || null : null
  } catch {
    return null
  }
}

let current: Status = { state: 'off', lastSyncedAt: readLast(), error: null }
const listeners = new Set<() => void>()

export function getStatus(): Status {
  return current
}

export function setStatus(patch: Partial<Status>): void {
  current = { ...current, ...patch }
  if (patch.lastSyncedAt) {
    try {
      localStorage.setItem(LAST, String(patch.lastSyncedAt))
    } catch {
      /* nothing here is worth failing a sync over */
    }
  }
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSyncStatus(): Status {
  return useSyncExternalStore(subscribe, getStatus, getStatus)
}

/* The label in the rail's foot. Four words, and one of them is nothing. */
export function statusLabel(status: Status): string {
  switch (status.state) {
    case 'off':
      return ''
    case 'syncing':
      return 'Syncing'
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Sync failed'
    default:
      return 'Synced'
  }
}
