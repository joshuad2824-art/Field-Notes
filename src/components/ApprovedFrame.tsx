import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../lib/media'
import { useAllNotebooks, isReserved, firstNotebookId, notebookOf, isWorkshopNotebook } from '../lib/notebooks'
import { setSettings, useSettings } from '../lib/settings'
import { navigate, parentOf, to, up, useRoute, type Route } from '../lib/router'
import { showCalendarMonth, selectCalendarDate, useCalendarView } from '../lib/calendar-view'
import { createPage, getPage, livePages } from '../lib/db'
import { getEvent } from '../lib/events'
import { collectWeek, lastWeekAt } from '../lib/journal'
import { isoDay } from '../lib/format'
import { JOURNAL_NOTEBOOK } from '../lib/model'
import { useLive } from '../lib/useLive'
import { closeTop, useDismiss } from '../lib/dismiss'
import { applyTheme, coverColor } from '../lib/theme'
import { AskSiena } from './AskSiena'
import { Icon } from './Icon'
import { NotebookManager } from './NotebookManager'
import { ShelfMenu } from './NotebookSwitcher'
import { QuickNote } from './QuickNote'
import { RouteLink } from './DeskHeader'
import { setEdgeColor } from '../lib/themecolor'
import { SyncMark } from './SyncMark'
import { useKeyboardOpen } from '../lib/viewport'
import { ColorTray, ColorsGlyph } from './ColorTray'

/* What a screen can ask of the frame: the back rooms and the quick note live
   here, once, rather than in every screen that offers them. */
interface FrameApi {
  quickNote: () => void
  manage: (focus?: string) => void
}
const FrameContext = createContext<FrameApi | null>(null)
export function useExternalRail() {
  return useContext(FrameContext) !== null
}
export function useFrame() {
  return useContext(FrameContext)
}

const editable = (el: Element | null) =>
  !!el &&
  ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

type Plus =
  | { kind: 'run'; label: string; run: () => void }
  | { kind: 'save'; label: string; run: () => void }
  | { kind: 'choose' }
  | { kind: 'off' }

export function ApprovedFrame({ notebook, children }: { notebook: string; children: ReactNode }) {
  const desktop = useMediaQuery('(min-width: 1200px)'),
    phone = useMediaQuery('(max-width: 819px)'),
    settings = useSettings(),
    keyboard = useKeyboardOpen(),
    route = useRoute(),
    calendar = useCalendarView(),
    books = useAllNotebooks()
  const [asking, setAsking] = useState(false),
    [manage, setManage] = useState<{ focus?: string } | null>(null),
    [colors, setColors] = useState(false),
    [menu, setMenu] = useState(false),
    [chooser, setChooser] = useState(false),
    [quick, setQuick] = useState(false),
    [receded, setReceded] = useState(false),
    [notice, setNotice] = useState(''),
    [chooserAt, setChooserAt] = useState<{ left: number; bottom: number } | null>(null),
    [expanded, setExpanded] = useState(false),
    [shelf, setShelf] = useState<{ left: number; bottom: number } | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const pageId = route.name === 'page' || route.name === 'plan' || route.name === 'review' ? route.id : ''
  const page = useLive(() => (pageId ? getPage(pageId) : Promise.resolve(undefined)), [pageId], undefined)
  const eventId = route.name === 'event' ? route.id : ''
  const event = useLive(() => (eventId ? getEvent(eventId) : Promise.resolve(undefined)), [eventId], undefined)
  const pages = useLive(livePages, [], [])
  const routeBook =
    route.name === 'notebook' || route.name === 'notebook-desk' ? route.notebook : page?.notebook
  const activeBook = notebookOf(routeBook ?? settings.themeNotebook)
  const themeBook = activeBook?.id ?? notebook
  const workshopPage =
    (route.name === 'page' && !!page && isWorkshopNotebook(page.notebook)) ||
    (route.name === 'notebook' && !!route.list)
  const notebookView = ['notebook', 'page', 'review'].includes(route.name)
  const home = ['overview', 'shelf'].includes(route.name),
    workshop = ['workshop', 'plans', 'plan'].includes(route.name) || workshopPage,
    calendarView = ['calendar', 'day', 'event', 'event-new'].includes(route.name)
  useEffect(() => {
    if (routeBook && routeBook !== settings.themeNotebook) setSettings({ themeNotebook: routeBook })
  }, [routeBook, settings.themeNotebook])
  useEffect(() => {
    applyTheme(activeBook?.color)
    setEdgeColor(
      ['workshop', 'plans', 'plan'].includes(route.name)
        ? '#2A2622'
        : ['calendar', 'day'].includes(route.name)
          ? coverColor(activeBook?.color)
          : '#001011',
    )
  }, [activeBook?.color, route.name])
  useEffect(() => {
    setMenu(false)
    setColors(false)
    setChooser(false)
    setExpanded(false)
    setShelf(null)
    if (route.name === 'calendar' && route.month) showCalendarMonth(route.month)
    if (route.name === 'day') selectCalendarDate(route.iso)
  }, [location.pathname])

  /* ← is up, to a fixed parent, never "wherever the browser was". */
  const parent = parentOf(route, {
    pageHome: page
      ? isWorkshopNotebook(page.notebook)
        ? to.workshop()
        : to.notebookHome(page.notebook)
      : undefined,
    eventDate: event?.date,
  })
  const goUp = () => {
    if (closeTop()) return
    if (parent) up(parent)
  }
  const latestUp = useRef(goUp)
  latestUp.current = goUp

  const rooms = [
    { label: 'Today', icon: 'overview' as const, href: to.overview(), active: home },
    {
      label: 'Notebooks',
      icon: 'notebook' as const,
      href: to.notebookHome(notebook),
      active: (notebookView && !workshopPage) || route.name === 'notebook-desk',
    },
    { label: 'Calendar', icon: 'calendar' as const, href: to.calendar(calendar.month), active: calendarView },
    { label: 'Workshop', icon: 'workshop' as const, href: to.workshop(), active: workshop },
    { label: 'From Siena', icon: 'from-siena' as const, href: to.fromSiena(), active: route.name === 'from-siena' },
  ]
  const latestRooms = useRef(rooms)
  latestRooms.current = rooms

  /* + makes the obvious thing for the room it is in. A page is made
     directly, as the list's own button always did: the /new capture route
     folds two captures inside a second into one, which is right for a
     Shortcut and wrong for a second deliberate tap. */
  const newPage = (book: string) =>
    void createPage(book).then((made) => navigate(to.page(made.id)))
  const reviewLastWeek = async () => {
    try {
      const done = await collectWeek(lastWeekAt())
      navigate(to.page(done.id))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open the weekly review.')
    }
  }
  /* While an event's form is open, + is its ✓: the obvious thing to do on a
     form is to keep it. The screen says when its form is open and what saving
     it is called (an event or a whole series). */
  const [eventForm, setEventForm] = useState('')
  useEffect(() => {
    const open = (e: Event) => setEventForm((e as CustomEvent<string>).detail || '')
    window.addEventListener('field-notes:event-form', open)
    return () => window.removeEventListener('field-notes:event-form', open)
  }, [])
  const saveEvent = () => window.dispatchEvent(new Event('field-notes:save-event'))

  const plus: Plus = (() => {
    if (quick) return { kind: 'off' }
    switch (route.name as Route['name']) {
      case 'notebook':
      case 'notebook-desk':
      case 'page':
      case 'review': {
        const book = routeBook ?? notebook
        if (book === JOURNAL_NOTEBOOK)
          return { kind: 'run', label: 'Review last week', run: () => void reviewLastWeek() }
        return { kind: 'run', label: 'New page', run: () => newPage(book) }
      }
      case 'calendar':
      case 'day':
        return { kind: 'run', label: 'New event', run: () => navigate(to.newEvent(calendar.selected)) }
      case 'event': {
        if (eventForm) return { kind: 'save', label: eventForm, run: saveEvent }
        const day = route.name === 'event' ? (route.occurrence ?? event?.date ?? calendar.selected) : ''
        return { kind: 'run', label: 'New event', run: () => navigate(to.newEvent(day)) }
      }
      case 'event-new':
        return { kind: 'save', label: eventForm || 'Save event', run: saveEvent }
      case 'workshop':
      case 'plans':
      case 'plan':
        return {
          kind: 'run',
          label: 'New plan',
          run: () => window.dispatchEvent(new CustomEvent('field-notes:workshop-action', { detail: 'plan' })),
        }
      default:
        return { kind: 'choose' }
    }
  })()

  /* The pill recedes when nothing is reaching for it: while scrolling down,
     while typing, and after three still seconds under a mouse. It returns on
     scroll up, at the end of a scroll, on any pointer movement, or a tap. */
  const held = menu || chooser || expanded || !!shelf
  const heldRef = useRef(held)
  heldRef.current = held
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let idle = 0,
      settle = 0
    const recede = () => {
      if (!heldRef.current) setReceded(true)
    }
    const arm = () => {
      clearTimeout(idle)
      if (fine.matches) idle = window.setTimeout(recede, 3000)
    }
    const show = () => {
      setReceded(false)
      arm()
    }
    const tops = new WeakMap<EventTarget, number>()
    const scroll = (e: Event) => {
      const el = (e.target === document ? document.scrollingElement : e.target) as Element | null
      if (!el || !('scrollTop' in el)) return
      const top = el.scrollTop,
        before = tops.get(el) ?? 0
      tops.set(el, top)
      if (top > before + 2) recede()
      else if (top < before - 2) show()
      clearTimeout(settle)
      settle = window.setTimeout(show, 260)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') show()
    }
    const type = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') && editable(e.target as Element))
        recede()
    }
    window.addEventListener('scroll', scroll, { capture: true, passive: true })
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('keydown', type, true)
    arm()
    return () => {
      clearTimeout(idle)
      clearTimeout(settle)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('keydown', type, true)
    }
  }, [])
  useEffect(() => {
    if (held) setReceded(false)
  }, [held])

  /* Keyboard: Esc closes what is open (lib/dismiss), then the editor lets go
     of the caret (CodeMirror), and only then goes up. ⌘↑ goes up when no field
     holds the caret. ⌘1–5 open the rooms in an installed app; ⌃1–5 too, since
     a browser tab keeps ⌘1–9 for itself. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      /* A native modal dialog takes Escape for itself. */
      if (document.querySelector('dialog[open]')) return
      const active = document.activeElement
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (editable(active)) {
          ;(active as HTMLElement).blur()
          return
        }
        e.preventDefault()
        latestUp.current()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (e.key === 'ArrowUp' && !editable(active)) {
        e.preventDefault()
        latestUp.current()
        return
      }
      if (/^[1-5]$/.test(e.key)) {
        e.preventDefault()
        navigate(latestRooms.current[Number(e.key) - 1].href)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useDismiss(menu, () => setMenu(false))
  useDismiss(chooser, () => setChooser(false))
  useDismiss(expanded, () => setExpanded(false))
  useDismiss(!!shelf, () => setShelf(null))
  useDismiss(colors, () => setColors(false))
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  const api: FrameApi = {
    quickNote: () => setQuick(true),
    manage: (focus) => setManage({ focus }),
  }
  const shownBook = routeBook ?? notebook
  const compact = phone
  const here = rooms.find((d) => d.active)
  /* On a desk or a tablet the pill already holds Today, so a ← that would
     only go to Today says it twice. A phone's pill doesn't show the rooms. */
  const showUp = !!parent && (compact || parent !== to.overview())
  const openShelf = () => {
    const r = navRef.current?.getBoundingClientRect()
    setMenu(false)
    setChooser(false)
    setExpanded(false)
    setShelf(r ? { left: r.left + r.width / 2, bottom: innerHeight - r.top + 12 } : { left: innerWidth / 2, bottom: 96 })
  }
  /* Notebooks from inside a notebook opens the shelf rather than reopening
     the notebook you are already in. */
  const roomTap = (e: React.MouseEvent, d: (typeof rooms)[number]) => {
    if (d.label === 'Notebooks' && d.active) {
      e.preventDefault()
      openShelf()
      return
    }
    setExpanded(false)
  }

  return (
    <FrameContext.Provider value={api}>
      <div
        className={`approved-application redesign-application route-${route.name}${keyboard ? ' keyboard-open' : ''}${workshop ? ' workshop-room' : ''}`}
      >
        <a
          className="fn-skip"
          href="#desk-heading"
          onClick={(e) => {
            e.preventDefault()
            const heading = document.querySelector<HTMLElement>('#desk-heading, main h1, .cm-content, main')
            if (heading && !heading.isContentEditable) heading.tabIndex = -1
            heading?.focus()
          }}
        >
          Skip to content
        </a>
        {desktop && notebookView && settings.rail ? (
          <aside className="board-sidebar" aria-label="Notebooks">
            <h1>{notebookOf(shownBook)?.name ?? 'Notebooks'}</h1>
            <nav>
              {books.map((book) => (
                <RouteLink
                  key={book.id}
                  href={to.notebookHome(book.id)}
                  className={book.id === routeBook ? 'active' : ''}
                  onClick={() => {
                    if (!isReserved(book.id)) setSettings({ notebook: book.id })
                  }}
                >
                  <i style={{ backgroundColor: coverColor(book.color) }} />
                  <span>{book.name}</span>
                </RouteLink>
              ))}
              <button
                className="board-sidebar-add"
                aria-label="Add a notebook"
                title="Add a notebook"
                onClick={() => setManage({})}
              >
                <Icon name="add" />
              </button>
            </nav>
          </aside>
        ) : null}
        <div className="approved-content">{children}</div>
        {home ? (
          <div className="board-sync">
            <SyncMark />
          </div>
        ) : null}
        {!keyboard ? (
          <>
            <nav
              ref={navRef}
              className={`floating-nav${receded ? ' receded' : ''}${quick ? ' above-quick' : ''}${compact ? ' compact' : ''}${expanded ? ' expanded' : ''}`}
              aria-label="Primary navigation"
              onFocus={() => setReceded(false)}
            >
              {showUp ? (
                <button className="pill-up" onClick={goUp} aria-label="Up" title="Up — ⌘↑">
                  <Icon name="back" />
                </button>
              ) : null}
              {compact ? (
                /* On a phone the pill is three marks: up, the room you are
                   in, and +. The room's own mark opens the rest in place. */
                <button
                  className={`pill-room${here ? ' active' : ''}`}
                  aria-label={here ? `${here.label} — rooms` : 'Rooms'}
                  title="Rooms"
                  aria-expanded={false}
                  onClick={() => {
                    setMenu(false)
                    setChooser(false)
                    setExpanded(true)
                  }}
                >
                  <Icon name={here?.icon ?? 'menu'} />
                </button>
              ) : (
                <>
                  {rooms.map((d) => (
                    <RouteLink
                      key={d.label}
                      className={`${d.active ? 'active ' : ''}pill-${d.label.toLowerCase().replace(' ', '-')}`}
                      href={d.href}
                      aria-label={d.label}
                      title={d.label}
                      aria-current={d.active ? 'page' : undefined}
                      onClick={(e) => roomTap(e, d)}
                    >
                      <Icon name={d.icon} />
                      {d.active && desktop ? <span>{d.label}</span> : null}
                    </RouteLink>
                  ))}
                  <span className="pill-rule" aria-hidden="true" />
                  <button
                    className={`pill-more${menu ? ' on' : ''}`}
                    aria-label="App menu"
                    title="App menu"
                    aria-haspopup="menu"
                    aria-expanded={menu}
                    onClick={() => {
                      setChooser(false)
                      setShelf(null)
                      setMenu(!menu)
                    }}
                  >
                    <Icon name="more" />
                  </button>
                </>
              )}
              {plus.kind === 'off' ? (
                <button className="pill-add" aria-label="Add" title="Add" aria-disabled="true" onClick={() => {}}>
                  <Icon name="add" />
                </button>
              ) : plus.kind === 'save' ? (
                <button className="pill-add pill-save" aria-label="Save event" title={plus.label} onClick={plus.run}>
                  <Icon name="done" />
                </button>
              ) : plus.kind === 'choose' ? (
                <button
                  ref={addRef}
                  className={`pill-add${chooser ? ' on' : ''}`}
                  aria-label="Add"
                  title="Add"
                  aria-haspopup="menu"
                  aria-expanded={chooser}
                  onClick={() => {
                    setMenu(false)
                    setShelf(null)
                    const r = addRef.current?.getBoundingClientRect()
                    if (r) setChooserAt({ left: r.left + r.width / 2, bottom: innerHeight - r.top + 12 })
                    setChooser(!chooser)
                  }}
                >
                  <Icon name="add" />
                </button>
              ) : (
                <button className="pill-add" aria-label={plus.label} title={plus.label} onClick={plus.run}>
                  <Icon name="add" />
                </button>
              )}
            </nav>
            {expanded ? (
              <>
                <button
                  className="nav-menu-scrim quiet"
                  aria-label="Close rooms"
                  tabIndex={-1}
                  onClick={() => setExpanded(false)}
                />
                <nav className="pill-rooms" aria-label="Rooms">
                  {rooms.map((d) => (
                    <RouteLink
                      key={d.label}
                      className={`${d.active ? 'active ' : ''}pill-${d.label.toLowerCase().replace(' ', '-')}`}
                      href={d.href}
                      aria-label={d.label}
                      title={d.label}
                      aria-current={d.active ? 'page' : undefined}
                      onClick={(e) => roomTap(e, d)}
                    >
                      <Icon name={d.icon} />
                    </RouteLink>
                  ))}
                  <span className="pill-rule" aria-hidden="true" />
                  <button
                    className="pill-more"
                    aria-label="App menu"
                    title="App menu"
                    aria-haspopup="menu"
                    onClick={() => {
                      setExpanded(false)
                      setMenu(true)
                    }}
                  >
                    <Icon name="more" />
                  </button>
                </nav>
              </>
            ) : null}
            <button
              className={`pill-handle${receded ? ' shown' : ''}`}
              aria-label="Show navigation"
              tabIndex={receded ? 0 : -1}
              aria-hidden={!receded}
              onClick={() => setReceded(false)}
            >
              <span />
            </button>
          </>
        ) : null}
        {notice ? (
          <p className="pill-notice" role="alert">
            {notice}
          </p>
        ) : null}
        {shelf ? (
          <>
            <button className="nav-menu-scrim quiet" aria-label="Close" tabIndex={-1} onClick={() => setShelf(null)} />
            <ShelfMenu current={shownBook} onDone={() => setShelf(null)} className="pill-shelf" style={shelf} />
          </>
        ) : null}
        {chooser ? (
          <>
            <button className="nav-menu-scrim quiet" aria-label="Close" tabIndex={-1} onClick={() => setChooser(false)} />
            <div className="add-chooser" role="menu" aria-label="Add" style={chooserAt ?? undefined}>
              <button
                role="menuitem"
                aria-label="New page"
                title="New page"
                onClick={() => {
                  setChooser(false)
                  newPage(notebook)
                }}
              >
                <Icon name="new-page" />
              </button>
              <button
                role="menuitem"
                aria-label="New event"
                title="New event"
                onClick={() => {
                  setChooser(false)
                  navigate(to.newEvent(isoDay()))
                }}
              >
                <Icon name="calendar" />
              </button>
              <button
                role="menuitem"
                aria-label="Quick note"
                title="Quick note"
                onClick={() => {
                  setChooser(false)
                  setQuick(true)
                }}
              >
                <Icon name="edit" />
              </button>
            </div>
          </>
        ) : null}
        {menu ? (
          <>
            <button className="nav-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
            <nav className="pill-menu" aria-label="App menu">
              <RouteLink href={to.search()}>
                <Icon name="search" />
                Search
              </RouteLink>
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
                  setManage({})
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
        {quick ? <QuickNote onClose={() => setQuick(false)} /> : null}
        {asking ? <AskSiena pages={pages} onClose={() => setAsking(false)} /> : null}
        {colors ? <ColorTray notebook={themeBook} pageId={pageId || undefined} onClose={() => setColors(false)} /> : null}
        {manage ? (
          <NotebookManager
            focus={manage.focus}
            onClose={() => setManage(null)}
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
