import { useEffect, useRef, type ReactNode } from 'react'
import type { Notebook } from '../../lib/model'
import { isoDay, weekOf } from '../../lib/format'
import { to } from '../../lib/router'
import { Icon } from '../Icon'
import { RouteLink } from '../DeskHeader'
import { SyncMark } from '../SyncMark'

/* A notebook ID already persists through rename, reorder, export and sync.
   Derive its visual height here instead of adding presentation to the schema. */
export function spineHeight(id: string): number {
  let hash = 0
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return 96 + hash % 33
}
const rooms = [
  { label: 'Today', icon: 'overview', href: to.overview() },
  { label: 'Workshop', icon: 'workshop', href: to.workshop() },
  { label: 'Calendar', icon: 'calendar', href: to.calendar() },
  { label: 'From Siena', icon: 'from-siena', href: to.fromSiena() },
] as const
export function Rail({ books, selectedNotebook, active = '/overview', unseen = 0, written = new Set<string>(), folded = false, onFold, weather }: { books: Notebook[]; selectedNotebook?: string; active?: string; unseen?: number; written?: Set<string>; folded?: boolean; onFold: () => void; weather?: string }) {
  const now = new Date()
  return <aside className={`kit-rail${folded ? ' is-folded' : ''}`} aria-label="Kit primary navigation">
    <div className="kit-rail-seal"><RouteLink href={to.overview()} aria-label="Field Notes home"><img src="/approved-design/rowan.png" alt="" />{!folded ? <span>Field<br />Notes</span> : null}</RouteLink><button aria-label={folded ? 'Expand navigation' : 'Fold navigation'} onClick={onFold}><Icon name={folded ? 'forward' : 'back'} /></button></div>
    <RouteLink className="kit-search" href={to.search()} aria-label="Search"><Icon name="search" />{!folded ? <><span>Search</span><kbd>⌘K</kbd></> : null}</RouteLink>
    <nav className="kit-room-links">{rooms.map(room => <RouteLink href={room.href} key={room.label} aria-label={`${room.label}${room.label === 'From Siena' && unseen ? `, ${unseen} unseen` : ''}`} title={room.label} aria-current={active === room.href ? 'page' : undefined}><Icon name={room.icon} />{!folded ? <span>{room.label}</span> : null}{room.label === 'From Siena' && unseen && !folded ? <span className="kit-unseen">{unseen}</span> : null}</RouteLink>)}</nav>
    <section className="kit-shelf" aria-label="Notebook shelf">{!folded ? <h2>Notebooks</h2> : null}<div className="kit-planks">{Array.from({ length: Math.ceil(books.length / 5) }, (_, i) => <div className="kit-plank" key={i}>{books.slice(i * 5, i * 5 + 5).map(book => <RouteLink key={book.id} className={`kit-spine${selectedNotebook === book.id ? ' is-open' : ''}`} href={to.notebookHome(book.id)} aria-label={`Open ${book.name} notebook`} title={book.name} style={{ backgroundColor: book.color, height: folded ? 6 : spineHeight(book.id) }}>{!folded ? <span>{book.name}</span> : null}</RouteLink>)}</div>)}</div></section>
    {!folded ? <section className="kit-week" aria-label="This week"><div><strong>{now.getDate()}</strong><span>{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short' }).format(now)}{weather ? <><br />{weather}</> : null}</span></div><div className="kit-week-strip">{weekOf().map(day => { const iso = isoDay(day.getTime()); return <RouteLink key={iso} href={to.day(iso)} aria-label={`${iso}${written.has(iso) ? ', with writing' : ''}`} className={`${written.has(iso) ? 'written' : ''}${iso === isoDay() ? ' today' : ''}`} aria-current={iso === isoDay() ? 'date' : undefined}>{day.getDate()}</RouteLink> })}</div><RouteLink className="kit-month-link" href={to.calendar()}>Open the month</RouteLink></section> : null}
    <footer className="kit-rail-foot">{folded ? <button className="kit-primary" disabled aria-label="Jot — coming in the next phase"><Icon name="new-page" /></button> : <><RouteLink href={to.settings()}>Settings</RouteLink><RouteLink href={to.trash()}>Trash</RouteLink><SyncMark /></>}</footer>
  </aside>
}
export function TabBar({ notebook, active = '/overview' }: { notebook: string; active?: string }) {
  const slots = [rooms[0], { label: 'Notebooks', icon: 'notebook' as const, href: to.notebookHome(notebook) }, null, rooms[1], rooms[2]]
  return <nav className="kit-tabbar" aria-label="Kit mobile navigation">{slots.map((slot, index) => slot ? <RouteLink key={slot.label} href={slot.href} aria-current={active === slot.href ? 'page' : undefined}><Icon name={slot.icon} /><span>{slot.label}</span></RouteLink> : <button key={index} className="kit-jot" disabled title="Jot — coming in the next phase"><Icon name="new-page" /><span>Jot</span></button>)}</nav>
}
export function RoomTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const node = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = node.current?.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: reduced ? 90 : 420, easing: 'cubic-bezier(.32,.08,.24,1)' })
    return () => animation?.cancel()
  }, [routeKey])
  return <div className="kit-room" ref={node}>{children}</div>
}
