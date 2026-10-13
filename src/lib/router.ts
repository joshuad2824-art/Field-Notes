import { useSyncExternalStore } from 'react'
import { ST_JOHN_NOTEBOOK } from './notebook-desk'

/* Forty lines instead of a dependency. A route is a path; the back button is
   the browser's, which is the one that matters on a phone. */

export type Route =
  | { name: 'kit' }
  | { name: 'shelf' }
  | { name: 'overview' }
  | { name: 'plans' }
  | { name: 'workshop' }
  | { name: 'from-siena' }
  | { name: 'event-new'; date?: string }
  | { name: 'event'; id: string; occurrence?: string }
  | { name: 'notebook'; notebook: string; list?: boolean }
  | { name: 'notebook-desk'; notebook: string }
  | { name: 'page'; id: string }
  | { name: 'review'; id: string }
  | { name: 'plan'; id: string; editing?: boolean }
  | { name: 'search' }
  | { name: 'tag'; tag: string }
  | { name: 'day'; iso: string }
  | { name: 'calendar'; month?: string }
  | { name: 'trash' }
  | { name: 'settings' }
  | { name: 'oauth-consent' }
  | { name: 'davis-callback' }
  /* The two that create rather than show: a new page, and a timestamped line
     on today's. Both land a live caret and replace themselves in history, so
     back never strands what they made. */
  | { name: 'new'; notebook?: string }
  | { name: 'today' }

const listeners = new Set<() => void>()

/* Which in-app entry the browser is standing on, and what the entries before
   it were. The browser will not say what is behind the back button, so the
   app keeps its own count: an index in each entry's state, and the paths this
   session has seen at each index. An entry from before this session — a deep
   link opened after some other site — has no path recorded, so ← never steps
   back into it. */
let index = typeof history.state?.fn === 'number' ? (history.state.fn as number) : 0
const entries: (string | undefined)[] = []
entries[index] = location.pathname
if (history.state?.fn !== index) history.replaceState({ ...(history.state ?? {}), fn: index }, '')

/* The last room that is not itself a back room, so Search, Settings, Trash
   and From Siena can return to wherever they were opened from. */
const SHEETS = new Set<Route['name']>(['search', 'settings', 'trash', 'from-siena'])
const PASSING = new Set<Route['name']>(['new', 'today', 'oauth-consent', 'davis-callback', 'kit'])
let lastRoom: string | null = null
function remember(path: string) {
  const name = parse(path).name
  if (!SHEETS.has(name) && !PASSING.has(name)) lastRoom = path
}

function emit() {
  remember(location.pathname)
  for (const fn of listeners) fn()
}

window.addEventListener('popstate', () => {
  index = typeof history.state?.fn === 'number' ? (history.state.fn as number) : 0
  entries[index] = location.pathname
  emit()
})

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search) return
  if (opts.replace) {
    history.replaceState({ fn: index }, '', path)
  } else {
    index += 1
    entries.length = index
    history.pushState({ fn: index }, '', path)
  }
  entries[index] = location.pathname
  emit()
}

/* Two paths are the same place when they parse to the same view — `/` and
   `/overview` are both Today. */
function samePlace(a: string, b: string) {
  const x = parse(a),
    y = parse(b)
  if (['shelf', 'overview'].includes(x.name) && ['shelf', 'overview'].includes(y.name)) return true
  return JSON.stringify(x) === JSON.stringify(y)
}

export interface UpContext {
  /* Where the open page lives: its notebook's home, or the Workshop. */
  pageHome?: string
  /* The day an event is being looked at on: its occurrence, or its date. */
  eventDate?: string
}

/* Every view has one fixed parent, so ← is "up" and never "wherever the
   browser happens to have been". Today has none. */
export function parentOf(route: Route, ctx: UpContext = {}): string | null {
  switch (route.name) {
    case 'shelf':
    case 'overview':
      return null
    case 'page':
      return ctx.pageHome ?? to.overview()
    case 'review':
      return to.page(route.id)
    case 'notebook':
      return route.list ? to.workshop() : to.overview()
    case 'notebook-desk':
      return to.overview()
    case 'day':
      return to.calendar(route.iso.slice(0, 7))
    case 'calendar':
      return to.overview()
    case 'event': {
      const day = route.occurrence ?? ctx.eventDate
      return day ? to.day(day) : to.calendar()
    }
    case 'event-new':
      return route.date ? to.day(route.date) : to.calendar()
    case 'plan':
      return route.editing ? to.plan(route.id) : to.workshop()
    case 'workshop':
    case 'plans':
      return to.overview()
    case 'tag':
      return to.search()
    case 'search':
    case 'settings':
    case 'trash':
    case 'from-siena':
      return lastRoom ?? to.overview()
    default:
      return to.overview()
  }
}

/* Go to the parent. When the entry just behind this one already is the
   parent, stepping back keeps the history tidy; otherwise the parent is
   pushed. Either way the browser never leaves the app. */
export function up(target: string) {
  const previous = entries[index - 1]
  if (index > 0 && previous && samePlace(previous, target)) history.back()
  else navigate(target)
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
  if (import.meta.env.DEV && parts[0] === 'kit') return { name: 'kit' }
  if (parts.length === 0) return { name: 'shelf' }
  if (parts[0] === 'plans') return { name: 'workshop' }
  if (parts[0] === 'workshop') return { name: 'workshop' }
  if (parts[0] === 'overview') return { name: 'overview' }
  if (parts[0] === 'from-siena') return { name: 'from-siena' }
  if (parts[0] === 'event' && parts[1] === 'new') return { name: 'event-new', date: parts[2] }
  if (parts[0] === 'event' && parts[1]) return { name: 'event', id: parts[1], ...(parts[2] ? { occurrence: parts[2] } : {}) }
  if (parts[0] === 'n' && parts[1] === 'workshop') return { name: 'workshop' }
  if (parts[0] === 'n' && parts[1] && parts[2] === 'desk') return { name: 'notebook-desk', notebook: parts[1] }
  /* The Workshop notebook's own page list; /n/<workshop> alone is the Workshop. */
  if (parts[0] === 'n' && parts[1] && parts[2] === 'pages') return { name: 'notebook', notebook: parts[1], list: true }
  if (parts[0] === 'n' && parts[1]) return { name: 'notebook', notebook: parts[1] }
  if (parts[0] === 'p' && parts[1]) return { name: 'page', id: parts[1] }
  if (parts[0] === 'review' && parts[1]) return { name: 'review', id: parts[1] }
  if (parts[0] === 'plan' && parts[1]) return { name: 'plan', id: parts[1], ...(parts[2] === 'edit' ? { editing: true } : {}) }
  if (parts[0] === 'tag' && parts[1]) return { name: 'tag', tag: parts[1] }
  if (parts[0] === 'day' && parts[1]) return { name: 'day', iso: parts[1] }
  if (parts[0] === 'calendar') return { name: 'calendar', month: parts[1] }
  if (parts[0] === 'search') return { name: 'search' }
  if (parts[0] === 'trash') return { name: 'trash' }
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'oauth' && parts[1] === 'consent') return { name: 'oauth-consent' }
  if (parts.length === 3 && parts[0] === 'oauth' && parts[1] === 'davis' && parts[2] === 'callback') return { name: 'davis-callback' }
  if (parts[0] === 'new') return { name: 'new', notebook: parts[1] }
  if (parts[0] === 'today') return { name: 'today' }
  return { name: 'shelf' }
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, snapshot, snapshot)
  return parse(path)
}

export const to = {
  shelf: () => '/',
  overview: () => '/overview',
  plans: () => '/workshop',
  workshop: () => '/workshop',
  fromSiena: () => '/from-siena',
  event: (id: string, occurrence?: string) => `/event/${id}${occurrence ? `/${occurrence}` : ''}`,
  newEvent: (date?: string) => date ? `/event/new/${date}` : '/event/new',
  notebook: (id: string) => `/n/${id}`,
  notebookPages: (id: string) => `/n/${encodeURIComponent(id)}/pages`,
  notebookDesk: (id: string) => `/n/${encodeURIComponent(id)}/desk`,
  notebookHome: (id: string) => id === ST_JOHN_NOTEBOOK ? `/n/${encodeURIComponent(id)}/desk` : `/n/${id}`,
  page: (id: string) => `/p/${id}`,
  review: (id: string) => `/review/${id}`,
  plan: (id: string) => `/plan/${encodeURIComponent(id)}`,
  planEdit: (id: string) => `/plan/${encodeURIComponent(id)}/edit`,
  tag: (tag: string) => `/tag/${encodeURIComponent(tag)}`,
  day: (iso: string) => `/day/${iso}`,
  calendar: (month?: string) => (month ? `/calendar/${month}` : '/calendar'),
  search: () => '/search',
  trash: () => '/trash',
  settings: () => '/settings',
  newPage: (notebook?: string) => (notebook ? `/new/${encodeURIComponent(notebook)}` : '/new'),
  today: () => '/today',
}

remember(location.pathname)
