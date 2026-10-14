import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import { AFTER_SCROLL_MS, HOLD_MS, REACH_PX, SETTLE_MS, travel, type Travel } from '../lib/pill-scroll'
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
    [shelf, setShelf] = useState<{ left: number; bottom: number } | null>(null),
    [resting, setResting] = useState(false),
    [wellX, setWellX] = useState<number | null>(null),
    [peek, setPeek] = useState<{ text: string; x: number } | null>(null),
    [arrival, setArrival] = useState(false)
  const lastCaption = useRef<{ text: string; x: number }>({ text: '', x: 0 })
  const swipe = useRef<{ y: number; raised: boolean } | null>(null)
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

  /* The pill recedes when nothing is reaching for it: while scrolling down
     and while typing. Under a mouse at rest it no longer leaves — after three
     still seconds it dims where it is, and any movement brings it back to
     full (October 13, third pass: on a desk a pill that vanished while you
     read and returned at every twitch read as flicker). It returns from a
     recede on scroll up, at the end of a scroll, on the mouse reaching for
     it, or a tap on the bar.

     October 14: "scroll up" and "down" are runs, not nudges, and a verdict
     holds for half a second before a scroll may reverse it. The rules are in
     lib/pill-scroll.ts, where the reasons are. What is left here is only the
     wiring: which events count, and what counts as quiet. */
  const held = menu || chooser || expanded || !!shelf
  const heldRef = useRef(held)
  heldRef.current = held
  const recededRef = useRef(receded)
  recededRef.current = receded
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let idle = 0,
      settle = 0,
      turned = -Infinity, // when a scroll last changed the pill
      scrolled = -Infinity, // when anything last scrolled
      reach: { x: number; y: number } | null = null
    const put = (value: boolean) => {
      if (recededRef.current === value) return
      recededRef.current = value
      setReceded(value)
    }
    const recede = () => {
      if (!heldRef.current) put(true)
    }
    const rest = () => {
      if (!heldRef.current) setResting(true)
    }
    const arm = () => {
      clearTimeout(idle)
      if (fine.matches) idle = window.setTimeout(rest, 3000)
    }
    const show = () => {
      put(false)
      setResting(false)
      arm()
    }
    const travels = new WeakMap<EventTarget, Travel>()
    const scroll = (e: Event) => {
      const el = (e.target === document ? document.scrollingElement : e.target) as Element | null
      if (!el || !('scrollTop' in el)) return
      const now = performance.now()
      scrolled = now
      /* Held between the ends: a spring past either is not the reader going up. */
      const top = Math.max(0, Math.min(el.scrollTop, el.scrollHeight - el.clientHeight))
      const { next, verdict } = travel(travels.get(el), top)
      travels.set(el, next)
      /* Reading is not resting: the dim waits for the scrolling to stop too. */
      arm()
      if (verdict && now - turned >= HOLD_MS) {
        const wanted = verdict === 'down'
        if (wanted !== recededRef.current && (!wanted || !heldRef.current)) {
          turned = now
          if (wanted) recede()
          else show()
        }
      }
      clearTimeout(settle)
      settle = window.setTimeout(show, SETTLE_MS)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      /* A mouse move just after a scroll is the browser refreshing what is under
         the pointer, or a hand on the wheel; the end of the scroll brings the
         pill back soon enough. */
      if (performance.now() - scrolled < AFTER_SCROLL_MS) return
      /* Counted from where the pointer last reached, so a slow drift adds up
         and a tremor does not. */
      if (reach && Math.hypot(e.clientX - reach.x, e.clientY - reach.y) < REACH_PX) return
      reach = { x: e.clientX, y: e.clientY }
      show()
    }
    const type = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') && editable(e.target as Element)) {
        /* Whatever the page scrolls to keep the caret in view is the typing
           moving it, and must not bring the pill back mid-sentence. */
        clearTimeout(settle)
        recede()
      }
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
    if (held) {
      setReceded(false)
      setResting(false)
    }
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

  /* The pill holds still (October 13, third pass). Every mark has a fixed
     slot on every route — ← keeps its slot even where there is nowhere up to
     go — and the room you are in is a well that settles from slot to slot
     rather than a mark that widens to carry its name. The name is a caption
     above the pill: under the pointer or focus, and for a moment on arrival. */
  const hereLabel = here?.label
  useLayoutEffect(() => {
    if (compact || keyboard) return
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    setWellX(active ? active.offsetLeft : null)
  }, [compact, keyboard, hereLabel, desktop])
  useEffect(() => {
    if (compact || !hereLabel) return
    setArrival(true)
    const timer = window.setTimeout(() => setArrival(false), 1400)
    return () => clearTimeout(timer)
  }, [compact, hereLabel])
  const caption =
    peek ?? (arrival && hereLabel && wellX !== null ? { text: hereLabel, x: wellX + 24 } : null)
  if (caption) lastCaption.current = caption
  const peekAt = (target: EventTarget | null) => {
    const mark = (target as Element | null)?.closest?.('a[aria-label], button[aria-label]') as HTMLElement | null
    if (!mark || !navRef.current?.contains(mark)) return setPeek(null)
    setPeek({ text: mark.getAttribute('aria-label') ?? '', x: mark.offsetLeft + mark.offsetWidth / 2 })
  }

  /* On a phone the room's mark says where you are and that it opens: the
     room's name (a notebook's own name inside one) and a small caret. */
  const roomName =
    here?.label === 'Notebooks' && routeBook
      ? (notebookOf(routeBook)?.name ?? 'Notebooks')
      : (here?.label ??
        ({ search: 'Search', settings: 'Settings', trash: 'Trash', tag: 'Tag' } as Record<string, string>)[route.name] ??
        'Rooms')

  /* The back rooms, drawn in the app menu on a tablet or desk and under the
     rooms in the phone's one sheet. */
  const backRooms = (close: () => void) => [
    <RouteLink key="search" href={to.search()} onClick={close}>
      <Icon name="search" />
      Search
    </RouteLink>,
    <button
      key="colors"
      onClick={() => {
        close()
        setColors(true)
      }}
    >
      <ColorsGlyph />
      Colors
    </button>,
    <button
      key="manage"
      onClick={() => {
        close()
        setManage({})
      }}
    >
      <Icon name="manage-notebooks" />
      Manage notebooks
    </button>,
    <button
      key="siena"
      onClick={() => {
        close()
        setAsking(true)
      }}
    >
      <Icon name="from-siena" />
      Ask Siena
    </button>,
    <RouteLink key="trash" href={to.trash()} onClick={close}>
      <Icon name="trash" />
      Trash
    </RouteLink>,
    <RouteLink key="settings" href={to.settings()} onClick={close}>
      <Icon name="settings" />
      Settings
    </RouteLink>,
  ]
  const chooserBook = notebookOf(notebook)
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
              className={`floating-nav steady${receded ? ' receded' : ''}${resting ? ' resting' : ''}${quick ? ' above-quick' : ''}${compact ? ' compact' : ''}${expanded ? ' expanded' : ''}`}
              aria-label="Primary navigation"
              onFocus={(e) => {
                setReceded(false)
                setResting(false)
                if (!compact) peekAt(e.target)
              }}
              onBlur={() => setPeek(null)}
              onPointerOver={(e) => {
                if (!compact && e.pointerType === 'mouse') peekAt(e.target)
              }}
              onPointerLeave={() => setPeek(null)}
              /* On a phone a short swipe up on the pill raises the sheet, and
                 the tap that ends it does nothing else. */
              onPointerDown={(e) => {
                if (compact) swipe.current = { y: e.clientY, raised: false }
              }}
              onPointerMove={(e) => {
                const s = swipe.current
                if (!compact || !s || s.raised || s.y - e.clientY < 24) return
                s.raised = true
                setMenu(false)
                setChooser(false)
                setShelf(null)
                setExpanded(true)
              }}
              onPointerUp={() => {
                if (!swipe.current?.raised) swipe.current = null
              }}
              onClickCapture={(e) => {
                if (swipe.current?.raised) {
                  e.preventDefault()
                  e.stopPropagation()
                }
                swipe.current = null
              }}
            >
              {compact ? null : (
                <>
                  <span
                    className={`pill-well${wellX === null ? ' none' : ''}`}
                    aria-hidden="true"
                    style={{ transform: `translateX(${wellX ?? 0}px)` }}
                  />
                  <span
                    className={`pill-caption${caption ? ' shown' : ''}`}
                    aria-hidden="true"
                    style={{ left: lastCaption.current.x }}
                  >
                    {lastCaption.current.text}
                  </span>
                </>
              )}
              {showUp ? (
                <button className="pill-up" onClick={goUp} aria-label="Up" title="Up — ⌘↑">
                  <Icon name="back" />
                </button>
              ) : (
                <span className="pill-up pill-void" aria-hidden="true" />
              )}
              {compact ? (
                /* On a phone the pill is three marks: up, the room you are
                   in — named, with a caret — and +. The room's mark raises
                   one sheet holding every room and every back room. */
                <button
                  className={`pill-room${here ? ' active' : ''}`}
                  aria-label={`${roomName} — go to`}
                  aria-haspopup="dialog"
                  aria-expanded={expanded}
                  onClick={() => {
                    setMenu(false)
                    setChooser(false)
                    setShelf(null)
                    setExpanded(!expanded)
                  }}
                >
                  <span className="pill-room-name">{roomName}</span>
                  <svg className="pill-room-caret" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 7.5 6 4.5 9 7.5" />
                  </svg>
                </button>
              ) : (
                <>
                  {rooms.map((d) => (
                    <RouteLink
                      key={d.label}
                      className={`${d.active ? 'active ' : ''}pill-${d.label.toLowerCase().replace(' ', '-')}`}
                      href={d.href}
                      aria-label={d.label}
                      aria-current={d.active ? 'page' : undefined}
                      onClick={(e) => roomTap(e, d)}
                    >
                      <Icon name={d.icon} />
                    </RouteLink>
                  ))}
                  <span className="pill-rule" aria-hidden="true" />
                  <button
                    className={`pill-more${menu ? ' on' : ''}`}
                    aria-label="App menu"
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
                <button className="pill-add" aria-label="Add" aria-disabled="true" onClick={() => {}}>
                  <Icon name="add" />
                </button>
              ) : plus.kind === 'save' ? (
                <button className="pill-add pill-save" aria-label="Save event" onClick={plus.run}>
                  <Icon name="done" />
                </button>
              ) : plus.kind === 'choose' ? (
                <button
                  ref={addRef}
                  className={`pill-add${chooser ? ' on' : ''}`}
                  aria-label="Add"
                  aria-haspopup="menu"
                  aria-expanded={chooser}
                  onClick={() => {
                    setMenu(false)
                    setShelf(null)
                    setExpanded(false)
                    const r = navRef.current?.getBoundingClientRect()
                    if (r) setChooserAt({ left: r.left + r.width / 2, bottom: innerHeight - r.top + 12 })
                    setChooser(!chooser)
                  }}
                >
                  <Icon name="add" />
                </button>
              ) : (
                <button className="pill-add" aria-label={plus.label} onClick={plus.run}>
                  <Icon name="add" />
                </button>
              )}
            </nav>
            {expanded ? (
              <>
                <button
                  className="nav-menu-scrim pill-sheet-scrim"
                  aria-label="Close rooms"
                  tabIndex={-1}
                  onClick={() => setExpanded(false)}
                />
                <div className="pill-sheet" role="dialog" aria-label="Go to">
                  <nav className="pill-sheet-rooms" aria-label="Rooms">
                    {rooms.map((d) => (
                      <RouteLink
                        key={d.label}
                        className={`${d.active ? 'active ' : ''}pill-${d.label.toLowerCase().replace(' ', '-')}`}
                        href={d.href}
                        aria-label={d.label}
                        aria-current={d.active ? 'page' : undefined}
                        onClick={(e) => roomTap(e, d)}
                      >
                        <Icon name={d.icon} />
                        <span aria-hidden="true">{d.label === 'From Siena' ? 'Siena' : d.label}</span>
                      </RouteLink>
                    ))}
                  </nav>
                  <hr />
                  <nav className="pill-sheet-back" aria-label="App menu">
                    {backRooms(() => setExpanded(false))}
                  </nav>
                </div>
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
            {/* + says what it will make, and where a page will be filed. */}
            <div className="add-chooser labelled" role="menu" aria-label="Add" style={chooserAt ?? undefined}>
              <button
                role="menuitem"
                aria-label="New page"
                onClick={() => {
                  setChooser(false)
                  newPage(notebook)
                }}
              >
                <Icon name="new-page" />
                <strong>Page</strong>
                <small>
                  <i style={{ background: coverColor(chooserBook?.color) }} />
                  {chooserBook?.name ?? 'Notebook'}
                </small>
              </button>
              <button
                role="menuitem"
                aria-label="New event"
                onClick={() => {
                  setChooser(false)
                  navigate(to.newEvent(isoDay()))
                }}
              >
                <Icon name="calendar" />
                <strong>Event</strong>
                <small>today</small>
              </button>
              <button
                role="menuitem"
                aria-label="Quick note"
                onClick={() => {
                  setChooser(false)
                  setQuick(true)
                }}
              >
                <Icon name="edit" />
                <strong>Quick note</strong>
                <small>file later</small>
              </button>
            </div>
          </>
        ) : null}
        {menu ? (
          <>
            <button className="nav-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
            <nav className="pill-menu" aria-label="App menu">
              {backRooms(() => setMenu(false))}
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
