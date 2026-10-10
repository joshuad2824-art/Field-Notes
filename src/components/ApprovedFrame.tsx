import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../lib/media'
import { useNotebooks, journalBook, isReserved, firstNotebookId } from '../lib/notebooks'
import { setSettings, useSettings } from '../lib/settings'
import { navigate, to, useRoute } from '../lib/router'
import { showCalendarMonth, selectCalendarDate, useCalendarView } from '../lib/calendar-view'
import { Icon } from './Icon'
import { CalendarPanel } from './CalendarPanel'
import { NotebookManager } from './NotebookManager'
import { RouteLink } from './DeskHeader'
import { setEdgeColor, surfaceColor, tokenColor } from '../lib/themecolor'
import { SyncMark } from './SyncMark'
import { WeatherLine } from './WeatherLine'
import { useKeyboardOpen } from '../lib/viewport'

const FrameContext = createContext(false)
export function useExternalRail() { return useContext(FrameContext) }

export function ApprovedFrame({ notebook, children }: { notebook: string; children: ReactNode }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const settings = useSettings()
  const keyboard = useKeyboardOpen()
  const route = useRoute()
  const calendar = useCalendarView()
  const books = useNotebooks()
  const [manage, setManage] = useState(false)
  useEffect(() => {
    if (route.name === 'calendar' && route.month) showCalendarMonth(route.month)
    if (route.name === 'day') selectCalendarDate(route.iso)
  }, [route.name, route.name === 'calendar' ? route.month : route.name === 'day' ? route.iso : ''])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const bottom = document.querySelector('.fn-mobile-navigation') ?? document.querySelector('.leaf')
      if (bottom) setEdgeColor(surfaceColor(bottom))
      else setEdgeColor(tokenColor('--frame-bg'))
    })
    return () => cancelAnimationFrame(frame)
  }, [route.name, location.pathname, desktop, keyboard])
  const primary: { label: string; icon: React.ComponentProps<typeof Icon>['name']; href: string; active: boolean }[] = [
    { label: 'Today', icon: 'overview', href: to.overview(), active: route.name === 'overview' || route.name === 'shelf' },
    { label: 'Notebooks', icon: 'notebook', href: to.notebookHome(notebook), active: ['notebook', 'notebook-desk', 'page'].includes(route.name) },
    { label: 'Workshop', icon: 'workshop', href: to.workshop(), active: ['workshop', 'plans', 'plan'].includes(route.name) },
  ]
  const mobile = [...primary, { label: 'Calendar', icon: 'calendar' as const, href: to.calendar(calendar.month), active: ['calendar', 'day', 'event', 'event-new'].includes(route.name) }]
  return <FrameContext.Provider value={desktop}><div className={`approved-application${desktop ? ' with-calendar-rail' : ''}${keyboard ? ' keyboard-open' : ''}`}>
    <a className="fn-skip" href="#desk-heading" onClick={event => { event.preventDefault(); const heading = document.getElementById('desk-heading') ?? document.querySelector<HTMLElement>('main h1, .cm-content, main'); if (heading && !heading.hasAttribute('tabindex') && !heading.isContentEditable) heading.setAttribute('tabindex', '-1'); heading?.focus() }}>Skip to content</a>
    {desktop && settings.rail ? <aside className="fn-rail rail" aria-label="Primary navigation">
      <div className="fn-seal rail-wordmark"><RouteLink className="fn-seal-home" href={to.overview()} aria-label="Field Notes home"><img className="fn-rowan rail-mark" src="/approved-design/rowan.png" alt="" /><span className="fn-brand-text rail-name"><span>Field</span><span>Notes</span></span></RouteLink><button className="mark-button tight" aria-label="Hide the notebooks" title="Hide the notebooks" onClick={() => setSettings({ rail: false })}><Icon name="back" /></button></div>
      <CalendarPanel />
      {route.name !== 'overview' && route.name !== 'shelf' ? <WeatherLine /> : null}
      <nav className="fn-rail-group">{primary.map(item => <RouteLink key={item.label} className={`fn-rail-button${item.active ? ' is-active' : ''}`} href={item.href} aria-label={item.label} title={item.label} aria-current={item.active ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></RouteLink>)}</nav>
      <section className="fn-sidebar-books" aria-label="Notebook shelf"><div className="fn-shelf-heading"><h2>Notebooks</h2><button aria-label="Manage notebooks" title="Manage notebooks" onClick={() => setManage(true)}><Icon name="manage-notebooks" /></button></div><div className="fn-book-spines">{[...books, journalBook()].map((book, index) => <RouteLink key={book.id} className="fn-book-spine" href={to.notebookHome(book.id)} onClick={() => { if (!isReserved(book.id)) setSettings({ notebook: book.id }) }} aria-label={`Open ${book.name} notebook`} title={book.name} style={{ backgroundColor: book.color, height: 128 - (index % 4) * 7 + (index % 4 === 2 ? 15 : 0) }}><span>{book.name}</span></RouteLink>)}<span className="fn-resting-book" aria-hidden="true" /></div></section>
      <nav className="fn-rail-foot" aria-label="Tools"><RouteLink href={to.search()} aria-label="Search" title="Search"><Icon name="search" /></RouteLink><RouteLink href={to.trash()} aria-label="Trash" title="Trash"><Icon name="trash" /></RouteLink><RouteLink href={to.settings()} aria-label="Settings" title="Settings"><Icon name="settings" /></RouteLink></nav><SyncMark />
    </aside> : null}
    <div className="approved-content">{children}</div>
    {desktop && !settings.rail && route.name !== 'page' && route.name !== 'notebook' ? <button className="approved-restore-rail" aria-label="Show the notebooks" title="Show the notebooks" onClick={() => setSettings({ rail: true })}><Icon name="menu" /></button> : null}
    {!desktop && !keyboard ? <nav className="fn-mobile-navigation" aria-label="Primary navigation">{mobile.map(item => <RouteLink key={item.label} className={item.active ? 'is-active' : ''} href={item.href} aria-label={item.label} title={item.label} aria-current={item.active ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></RouteLink>)}</nav> : null}
    {manage ? <NotebookManager onClose={() => setManage(false)} onAdded={id => { if (!isReserved(id)) setSettings({ notebook: id }); navigate(to.notebook(id)) }} onDeleted={id => { if (id === notebook) { const next = books.find(book => book.id !== id)?.id ?? firstNotebookId(); setSettings({ notebook: next }); navigate(to.notebook(next), { replace: true }) } }} /> : null}
  </div></FrameContext.Provider>
}
