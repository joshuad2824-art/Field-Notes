// A read-only, memory-only presentation model. No Field Notes database writes,
// recurrence expansion, refresh tokens, or credentials in localStorage.
import { DavisIdentityError, type DavisSource } from './wire'
export const DAVIS_AGENDA_URL = 'https://davis-at-home.netlify.app/integrations/field-notes/agenda'
export const DAVIS_CALLBACK_PATH = '/oauth/davis/callback'
export interface AgendaEntry {
  sourceId: string
  version: string
  title: string
  kind: 'event' | 'reminder'
  startDate: string
  endDate?: string
  time?: string
  owner?: string
  audience?: string
  source?: DavisSource
  location?: string
  note?: string
}
export interface AgendaSnapshot {
  accountId: string
  householdId: string
  householdName?: string
  timezone: string
  today: string
  fetchedAt: string
  entries: AgendaEntry[]
  from?: string
  to?: string
  sourceUrl?: string
}
export type AgendaState =
  | { status: 'setup' | 'disconnected' | 'loading' | 'denied'; snapshot?: never }
  | { status: 'ready' | 'stale'; snapshot: AgendaSnapshot; reason?: 'refresh-failed' }
  | { status: 'error' | 'offline'; snapshot?: AgendaSnapshot }
export type AgendaResult = { status: number; snapshot?: AgendaSnapshot }
export type AgendaReader = (signal: AbortSignal) => Promise<AgendaResult>

// The HTTP adapter validates complete wire snapshots before this projection.
export function createAgendaStore() {
  let state: AgendaState = { status: 'setup' }
  let account = ''
  let household = ''
  let reader: AgendaReader | undefined
  let onClear: (() => void) | undefined
  let controller: AbortController | undefined
  let generation = 0
  const listeners = new Set<() => void>()
  const publish = (next: AgendaState) => { state = next; for (const fn of listeners) fn() }
  const clear = (status: 'disconnected' | 'denied') => {
    generation++; controller?.abort(); controller = undefined; reader = undefined; account = ''; household = ''
    const cleanup = onClear; onClear = undefined; cleanup?.(); publish({ status })
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    disconnect: () => clear('disconnected'),
    connect(accountId: string, read: AgendaReader, cleanup?: () => void) {
      generation++; controller?.abort(); onClear?.(); account = accountId; household = ''; reader = read; onClear = cleanup
      publish({ status: 'loading' }) // a new account never inherits old protected data
    },
    async refresh(online = navigator.onLine) {
      if (!reader) return
      const previous = state.snapshot
      const epoch = ++generation
      controller?.abort(); controller = new AbortController()
      if (!online) { publish({ status: 'offline', snapshot: previous }); return }
      if (!previous) publish({ status: 'loading' })
      const requestController = controller
      const timeout = window.setTimeout(() => requestController.abort(), 20_000)
      try {
        const result = await reader(controller.signal)
        if (epoch !== generation) return
        if (result.status === 401 || result.status === 403) { clear('denied'); return }
        if (result.snapshot && (result.snapshot.accountId !== account || (household && result.snapshot.householdId !== household))) { clear('denied'); return }
        if (result.status !== 200 || !result.snapshot) throw new Error('Agenda unavailable')
        const data = result.snapshot
        if (!data.householdId || !data.timezone || !/^\d{4}-\d{2}-\d{2}$/.test(data.today) || !Number.isFinite(Date.parse(data.fetchedAt)) || !Array.isArray(data.entries)) throw new Error('Invalid agenda')
        if (data.entries.some((entry) => !entry.sourceId || typeof entry.version !== 'string' || typeof entry.title !== 'string' || !['event', 'reminder'].includes(entry.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate) || (entry.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.endDate) || entry.endDate < entry.startDate)))) throw new Error('Invalid agenda entries')
        // Drop duplicate occurrences/reminders by their already-expanded source ID.
        const entries = [...new Map(data.entries.map((entry) => [entry.sourceId, entry])).values()]
        household = data.householdId
        publish({ status: 'ready', snapshot: { ...data, entries } })
      } catch (error) {
        if (epoch !== generation) return
        if (error instanceof DavisIdentityError) { clear('denied'); return }
        publish(!navigator.onLine ? { status: 'offline', snapshot: previous } : previous ? { status: 'stale', snapshot: previous, reason: 'refresh-failed' } : { status: 'error' })
      } finally { window.clearTimeout(timeout) }
    },
    markStale() { if (state.snapshot) publish({ status: 'stale', snapshot: state.snapshot }) },
  }
}
export const davisAgenda = createAgendaStore()
