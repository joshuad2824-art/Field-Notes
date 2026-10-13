import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../lib/media'
import {
  useAllNotebooks,
  isReserved,
  firstNotebookId,
  notebookOf,
  isWorkshopNotebook,
} from '../lib/notebooks'
import { setSettings, useSettings } from '../lib/settings'
import { back, navigate, to, useRoute } from '../lib/router'
import { showCalendarMonth, selectCalendarDate, useCalendarView } from '../lib/calendar-view'
import { getPage, livePages } from '../lib/db'
import { useLive } from '../lib/useLive'
import { applyTheme, coverColor } from '../lib/theme'
import { AskSiena } from './AskSiena'
import { Icon } from './Icon'
import { NotebookManager } from './NotebookManager'
import { RouteLink } from './DeskHeader'
import { setEdgeColor } from '../lib/themecolor'
import { SyncMark } from './SyncMark'
import { useKeyboardOpen } from '../lib/viewport'
import { ColorTray, ColorsGlyph } from './ColorTray'
const FrameContext = createContext(false)
export function useExternalRail() {
  return useContext(FrameContext)
}
export function ApprovedFrame({
  notebook,
  children,
}: {
  notebook: string
  children: ReactNode
}) {
  const desktop = useMediaQuery('(min-width: 1200px)'),
    settings = useSettings(),
    keyboard = useKeyboardOpen(),
    route = useRoute(),
    calendar = useCalendarView(),
    books = useAllNotebooks()
  const [asking, setAsking] = useState(false),
    [manage, setManage] = useState(false),
    [colors, setColors] = useState(false),
    [menu, setMenu] = useState(false)
  const pageId =
    route.name === 'page' || route.name === 'plan' || route.name === 'review' ? route.id : ''
  const page = useLive(
    () => (pageId ? getPage(pageId) : Promise.resolve(undefined)),
    [pageId],
    undefined,
  )
  const pages = useLive(livePages, [], [])
  const routeBook =
    route.name === 'notebook' || route.name === 'notebook-desk'
      ? route.notebook
      : page?.notebook
  const activeBook = notebookOf(routeBook ?? settings.themeNotebook)
  const themeBook = activeBook?.id ?? notebook
  const notebookView = ['notebook', 'page', 'review'].includes(route.name)
  const home = ['overview', 'shelf'].includes(route.name),
    workshop = ['workshop', 'plans', 'plan'].includes(route.name),
    calendarView = ['calendar', 'day', 'event', 'event-new'].includes(route.name)
  useEffect(() => {
    if (routeBook && routeBook !== settings.themeNotebook)
      setSettings({ themeNotebook: routeBook })
  }, [routeBook, settings.themeNotebook])
  useEffect(() => {
    applyTheme(activeBook?.color)
    setEdgeColor(
      workshop
        ? '#2A2622'
        : ['calendar', 'day'].includes(route.name)
          ? coverColor(activeBook?.color)
          : '#001011',
    )
  }, [activeBook?.color, workshop, route.name])
  useEffect(() => {
    setMenu(false)
    setColors(false)
    if (route.name === 'calendar' && route.month) showCalendarMonth(route.month)
    if (route.name === 'day') selectCalendarDate(route.iso)
  }, [location.pathname])
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false)
        setColors(false)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  useEffect(() => {
    const open = () => setMenu((value) => !value)
    window.addEventListener('field-notes:workshop-menu', open)
    return () => window.removeEventListener('field-notes:workshop-menu', open)
  }, [])
  const destinations = [
    { label: 'Today', icon: 'overview' as const, href: to.overview(), active: home },
    {
      label: 'Notebooks',
      icon: 'notebook' as const,
      href: to.notebookHome(notebook),
      active: notebookView,
    },
    {
      label: 'Calendar',
      icon: 'calendar' as const,
      href: to.calendar(calendar.month),
      active: calendarView,
    },
    { label: 'Workshop', icon: 'workshop' as const, href: to.workshop(), active: workshop },
    {
      label: 'From Siena',
      icon: 'from-siena' as const,
      href: to.fromSiena(),
      active: route.name === 'from-siena',
    },
  ]
  const add = () => {
    if (calendarView || home)
      navigate(to.newEvent(route.name === 'day' ? route.iso : calendar.selected))
    else if (workshop) {
      if (route.name === 'plan') navigate(to.workshop())
      else
        window.dispatchEvent(new CustomEvent('field-notes:workshop-action', { detail: 'plan' }))
    } else navigate(to.newPage(isReserved(themeBook) ? notebook : themeBook))
  }
  return (
    <FrameContext.Provider value={true}>
      <div
        className={`approved-application redesign-application route-${route.name}${keyboard ? ' keyboard-open' : ''}${workshop ? ' workshop-room' : ''}`}
      >
        <a
          className="fn-skip"
          href="#desk-heading"
          onClick={(e) => {
            e.preventDefault()
            const heading = document.querySelector<HTMLElement>(
              '#desk-heading, main h1, .cm-content, main',
            )
            if (heading && !heading.isContentEditable) heading.tabIndex = -1
            heading?.focus()
          }}
        >
          Skip to content
        </a>
        {desktop && notebookView && settings.rail ? (
          <aside className="board-sidebar" aria-label="Notebooks">
            <span className="section-label">Notebook</span>
            <h1>{notebookOf(routeBook ?? notebook)?.name ?? 'Notebooks'}</h1>
            <nav>
              {books.map((book) => (
                <RouteLink
                  key={book.id}
                  href={to.notebookHome(book.id)}
                  className={book.id === routeBook ? 'active' : ''}
                >
                  <i style={{ backgroundColor: coverColor(book.color) }} />
                  <span>{book.name}</span>
                  <small>{pages.filter((p) => p.notebook === book.id).length}</small>
                </RouteLink>
              ))}
              <button onClick={() => setManage(true)}>
                <Icon name="circle" />
                Add a notebook
              </button>
            </nav>
            <footer>
              <RouteLink href={to.overview()} aria-label="Today" title="Today">
                <Icon name="overview" />
              </RouteLink>
              <button aria-label="Colors" title="Colors" onClick={() => setColors(true)}>
                <ColorsGlyph />
              </button>
              <RouteLink href={to.trash()} aria-label="Trash" title="Trash">
                <Icon name="trash" />
              </RouteLink>
              <RouteLink href={to.settings()} aria-label="Settings" title="Settings">
                <Icon name="settings" />
              </RouteLink>
            </footer>
          </aside>
        ) : null}
        <div className="approved-content">{children}</div>
        {home ? (
          <div className="board-sync">
            <SyncMark />
          </div>
        ) : null}
        {['calendar', 'day'].includes(route.name) ? (
          <div className="calendar-view-tools">
            <button
              aria-label={route.name === 'calendar' ? 'Day agenda' : 'Full calendar'}
              title={route.name === 'calendar' ? 'Day agenda' : 'Full calendar'}
              onClick={() =>
                navigate(
                  route.name === 'calendar'
                    ? to.day(calendar.selected)
                    : to.calendar(
                        route.name === 'day' ? route.iso.slice(0, 7) : calendar.month,
                      ),
                )
              }
            >
              <Icon name={route.name === 'calendar' ? 'list' : 'calendar'} />
            </button>
            <button
              aria-label="Calendar tools"
              title="Calendar tools"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name="more" />
            </button>
          </div>
        ) : null}
        {!keyboard &&
        !['calendar', 'day', 'workshop', 'plans'].includes(route.name) &&
        !(desktop && notebookView) ? (
          <nav className="floating-nav" aria-label="Primary navigation">
            {home ? (
              destinations
                .filter((d) => d.label !== 'Calendar')
                .map((d) => (
                  <RouteLink
                    key={d.label}
                    className={`${d.active ? 'active ' : ''}pill-${d.label.toLowerCase().replace(' ', '-')}`}
                    href={d.href}
                    aria-label={d.label}
                    title={d.label}
                    aria-current={d.active ? 'page' : undefined}
                  >
                    <Icon name={d.icon} />
                    {d.active && desktop ? <span>{d.label}</span> : null}
                  </RouteLink>
                ))
            ) : (
              <button onClick={() => back(to.overview())} aria-label="Back" title="Back">
                <Icon name="back" />
              </button>
            )}
            {!home && route.name === 'page' ? (
              <button
                aria-label="Page style"
                title="Page style"
                onClick={() =>
                  document
                    .querySelector<HTMLButtonElement>('button[aria-label="Style"]')
                    ?.click()
                }
              >
                Aa
              </button>
            ) : null}
            {!home && !notebookView ? (
              <RouteLink
                href={to.calendar(calendar.month)}
                aria-label="Calendar"
                title="Calendar"
              >
                <Icon name="calendar" />
              </RouteLink>
            ) : null}
            <button
              className={menu ? 'active' : ''}
              aria-label="Navigation and filters"
              title="Navigation and filters"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name="filter" />
            </button>
            {route.name === 'event' ? (
              <button
                aria-label="Edit event"
                title="Edit event"
                onClick={() => window.dispatchEvent(new Event('field-notes:edit-event'))}
              >
                <Icon name="edit" />
              </button>
            ) : null}
            {route.name === 'event' ? (
              <button
                aria-label="Delete event"
                title="Delete event"
                onClick={() => window.dispatchEvent(new Event('field-notes:delete-event'))}
              >
                <Icon name="trash" />
              </button>
            ) : (
              <button
                className="pill-add"
                aria-label={
                  calendarView || home ? 'Add event' : workshop ? 'New plan' : 'New page'
                }
                title="Add"
                onClick={add}
              >
                <Icon name="add" />
              </button>
            )}
          </nav>
        ) : null}
        {menu ? (
          <>
            <button
              className="nav-menu-scrim"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            />
            <nav className="pill-menu" aria-label="All destinations">
              {['workshop', 'plans'].includes(route.name) ? (
                <>
                  {[
                    ['plan', 'New plan'],
                    ['equipment', 'Add equipment'],
                    ['projects', 'On my desk'],
                  ].map(([action, label]) => (
                    <button
                      key={action}
                      onClick={() => {
                        setMenu(false)
                        window.dispatchEvent(
                          new CustomEvent('field-notes:workshop-action', { detail: action }),
                        )
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </>
              ) : null}
              {['workshop', 'plans'].includes(route.name) ? (
                <RouteLink
                  href={to.notebook(
                    books.find((b) => isWorkshopNotebook(b.id))?.id ?? notebook,
                  )}
                >
                  Workshop pages
                </RouteLink>
              ) : null}
              {calendarView ? (
                <>
                  <button
                    onClick={() => {
                      setMenu(false)
                      add()
                    }}
                  >
                    <Icon name="add" />
                    New event
                  </button>
                  <RouteLink href={to.day(calendar.selected)}>
                    <Icon name="list" />
                    Day agenda
                  </RouteLink>
                </>
              ) : null}
              {destinations.map((d) => (
                <RouteLink key={d.label} href={d.href}>
                  <Icon name={d.icon} />
                  {d.label}
                </RouteLink>
              ))}
              <button
                onClick={() => {
                  setMenu(false)
                  setColors(true)
                }}
              >
                <ColorsGlyph />
                Colors
              </button>
              <button
                onClick={() => {
                  setMenu(false)
                  setManage(true)
                }}
              >
                <Icon name="manage-notebooks" />
                Manage notebooks
              </button>
              <button
                onClick={() => {
                  setMenu(false)
                  setAsking(true)
                }}
              >
                <Icon name="from-siena" />
                Ask Siena
              </button>
              <RouteLink href={to.search()}>
                <Icon name="search" />
                Search
              </RouteLink>
              <RouteLink href={to.trash()}>
                <Icon name="trash" />
                Trash
              </RouteLink>
              <RouteLink href={to.settings()}>
                <Icon name="settings" />
                Settings
              </RouteLink>
            </nav>
          </>
        ) : null}
        {asking ? <AskSiena pages={pages} onClose={() => setAsking(false)} /> : null}
        {colors ? (
          <ColorTray
            notebook={themeBook}
            pageId={pageId || undefined}
            onClose={() => setColors(false)}
          />
        ) : null}
        {manage ? (
          <NotebookManager
            onClose={() => setManage(false)}
            onAdded={(id) => {
              setSettings({ notebook: id, themeNotebook: id })
              navigate(to.notebook(id))
            }}
            onDeleted={(id) => {
              if (id === notebook) {
                const next = firstNotebookId()
                setSettings({ notebook: next, themeNotebook: next })
                navigate(to.notebook(next), { replace: true })
              }
            }}
          />
        ) : null}
      </div>
    </FrameContext.Provider>
  )
}
