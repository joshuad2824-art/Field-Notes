import { useSyncExternalStore } from 'react'

/* Forty lines instead of a dependency. A route is a path; the back button is
   the browser's, which is the one that matters on a phone. */

export type Route =
  | { name: 'shelf' }
  | { name: 'notebook'; notebook: string }
  | { name: 'page'; id: string }
  | { name: 'search' }
  | { name: 'tag'; tag: string }
  | { name: 'day'; iso: string }
  | { name: 'calendar'; month?: string }
  | { name: 'trash' }
  | { name: 'settings' }

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

window.addEventListener('popstate', emit)

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search) return
  if (opts.replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  emit()
}

export function back(fallback = '/') {
  if (history.length > 1) history.back()
  else navigate(fallback, { replace: true })
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function snapshot() {
  return location.pathname
}

export function parse(path: string): Route {
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length === 0) return { name: 'shelf' }
  if (parts[0] === 'n' && parts[1]) return { name: 'notebook', notebook: parts[1] }
  if (parts[0] === 'p' && parts[1]) return { name: 'page', id: parts[1] }
  if (parts[0] === 'tag' && parts[1]) return { name: 'tag', tag: parts[1] }
  if (parts[0] === 'day' && parts[1]) return { name: 'day', iso: parts[1] }
  if (parts[0] === 'calendar') return { name: 'calendar', month: parts[1] }
  if (parts[0] === 'search') return { name: 'search' }
  if (parts[0] === 'trash') return { name: 'trash' }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'shelf' }
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, snapshot, snapshot)
  return parse(path)
}

export const to = {
  shelf: () => '/',
  notebook: (id: string) => `/n/${id}`,
  page: (id: string) => `/p/${id}`,
  tag: (tag: string) => `/tag/${encodeURIComponent(tag)}`,
  day: (iso: string) => `/day/${iso}`,
  calendar: (month?: string) => (month ? `/calendar/${month}` : '/calendar'),
  search: () => '/search',
  trash: () => '/trash',
  settings: () => '/settings',
}
