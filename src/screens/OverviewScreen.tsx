import { useSienaItems } from '../lib/useSienaItems'
import { useWorkCalendar } from '../work-calendar/calendar'
import { useFrame } from '../components/ApprovedFrame'
import { useLongPress } from '../lib/long-press'
import { ST_JOHN_NOTEBOOK } from '../lib/notebook-desk'
import { activeSienaItems } from '../lib/siena-archive'
import { useEffect, useRef, useState } from 'react'
import { shiftDate } from '../lib/event-recurrence'
import { eventOnDay } from '../lib/event-range'
import { EventRow } from '../components/EventRow'
import { SienaItemCard } from '../components/SienaItemCard'
import { SienaBody } from '../components/SienaBody'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { useAppleCalendar } from '../apple/calendar'
import { DAVIS_SOURCE_URL } from '../davis/wire'
import { RouteLink } from '../components/DeskHeader'
import { BoardWeather } from '../components/BoardWeather'
import { MonthGrid } from '../components/MonthGrid'
import { Icon } from '../components/Icon'
import { weekAhead } from '../lib/agenda'
import { liveEvents } from '../lib/events'
import { livePages } from '../lib/db'
import { isoDay } from '../lib/format'
import { dayOf, monthParts } from '../lib/calendar'
import { JOURNAL_NOTEBOOK } from '../lib/model'
import { useAllNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
export function OverviewScreen({ notebook: _notebook }: { notebook: string }) {
  const [today, setToday] = useState(isoDay)
  const frame = useFrame()
  /* Once a minute: the date can turn over. */
  useEffect(() => {
    const timer = setInterval(() => {
      setToday(isoDay())
    }, 60000)
    return () => clearInterval(timer)
  }, [])
  const pages = useLive(livePages, [], []),
    localEvents = useLive(liveEvents, [], []),
    family = useFamilyAgenda(),
    apple = useAppleCalendar(`${today.slice(0, 7)}-01`, shiftDate(`${today.slice(0, 7)}-28`, 20)),
    work = useWorkCalendar(`${today.slice(0, 7)}-01`, shiftDate(`${today.slice(0, 7)}-28`, 20)),
    items = useSienaItems(),
    books = useAllNotebooks()
  const month = today.slice(0, 7),
    date = new Date(today + 'T12:00:00'),
    { month: monthName, year } = monthParts(month)
  const allEvents = mergeCalendarEvents(
      localEvents,
      family,
      `${month}-01`,
      shiftDate(`${month}-28`, 20),
      apple, work,
    ),
    /* Calendar sources stay together; only Siena messages and reminders are
       separated by their explicit St. John notebook association. */
    events = allEvents.filter((e) => eventOnDay(e, today)),
    personal = activeSienaItems(items).filter(item => item.notebook !== ST_JOHN_NOTEBOOK),
    messages = personal.filter(item => item.type !== 'reminder').sort((a,b) => b.created-a.created),
    unseen = messages.filter(item => !item.seenAt).length,
    upcoming = weekAhead(today, allEvents, []).filter((entry) => entry.events.length)
  const written = new Set(pages.filter((p) => p.notebook !== JOURNAL_NOTEBOOK).map(dayOf)),
    marked = new Set([
      ...allEvents.flatMap((e) =>
        Array.from({ length: 62 }, (_, i) => shiftDate(`${month}-01`, i)).filter((d) =>
          eventOnDay(e, d),
        ),
      ),
      ...(events.length ? [today] : []),
    ])
  const reminders = personal.filter(item => item.type === 'reminder').sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.created-b.created),
    familyReminders = (family.snapshot?.entries ?? []).filter((e) => e.kind === 'reminder')
  /* The note's card fades at its foot only when there is more to scroll. */
  const sienaRef = useRef<HTMLElement>(null)
  const [sienaMore, setSienaMore] = useState(false)
  useEffect(() => {
    const el = sienaRef.current
    if (!el) return
    const check = () => setSienaMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [messages.map(item => `${item.id}:${item.updated}`).join('|')])
  return (
    <div className="app board-app">
      <main className="board-screen scroll">
        <header className="board-header">
          <h1 id="desk-heading" className="room-heading">Field Notes</h1>
          <div>
            <RouteLink href={to.search()} aria-label="Search" title="Search">
              <Icon name="search" />
            </RouteLink>
            <RouteLink href={to.settings()} aria-label="Settings" title="Settings">
              <Icon name="settings" />
            </RouteLink>
          </div>
        </header>
        <div className="today-board">
          <section className={`board-tile board-day${!events.length && !upcoming.length ? ' is-quiet' : ''}`}>
            <RouteLink className="day-spine" href={to.calendar(month)}>
              <span>
                {date.toLocaleDateString([], { weekday: 'long' })} <b>{date.getDate()}</b>{' '}
                {monthName}
              </span>
            </RouteLink>
            <div className="day-content">
              {events.length ? (
                <section className="board-today-schedule">
                  <h2>Today</h2>
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </section>
              ) : null}
              {/* Only dates with events, and no heading over nothing. */}
              {upcoming.length ? (
              <section className="board-day-coming">
                <h2>Coming up</h2>
                {upcoming.length
                  ? upcoming.map((entry) => (
                      <div className="board-upcoming-row" key={entry.iso}>
                        <RouteLink href={to.day(entry.iso)}>
                          {new Date(entry.iso + 'T12:00:00').toLocaleDateString([], {
                            weekday: 'short',
                            day: 'numeric',
                          })}
                        </RouteLink>
                        <div>
                          {entry.events.map((e) => (
                            <EventRow key={e.id} event={e} />
                          ))}
                        </div>
                      </div>
                    ))
                  : null}
              </section>
              ) : null}
            </div>
          </section>
          <section className="board-tile board-month">
            <div>
              <RouteLink className="board-calendar-link" href={to.calendar(month)}>
                <h2>
                  {monthName} <span>{year}</span>
                </h2>
              </RouteLink>
              <MonthGrid
                month={month}
                written={written}
                events={marked}
                onPick={() => navigate(to.calendar(month))}
              />
            </div>
          </section>
          <section className="board-tile board-weather-card">
            <div className="board-current-weather">
              <BoardWeather />
            </div>
            <BoardWeather compact />
          </section>
          <section className="board-tile board-weather-tile">
            <button
              className="quick-note-open"
              onClick={() => frame?.quickNote()}
              aria-label="Quick note"
            >
              <strong>Quick note</strong>
            </button>
          </section>
          {/* The weekday and date stay above the capture tool on a desk. */}
          <RouteLink className="board-tile board-date" href={to.calendar(month)}>
            <strong>{date.toLocaleDateString([], { weekday: 'short' })}</strong>
            <span>
              {date.getDate()} {date.toLocaleDateString([], { month: 'short' })}
            </span>
          </RouteLink>
          <section
            ref={sienaRef}
            className={`board-tile board-siena${sienaMore ? ' has-more' : ''}`}
            tabIndex={0}
            aria-label="From Siena message"
          >
            <div className="board-tile-label">
              <h2><RouteLink href={to.fromSiena()}>From Siena</RouteLink></h2>
              {unseen ? <span className="board-badge">{unseen} new</span> : null}
            </div>
            {messages.length ? messages.map(item => (
              <article className="board-message" key={item.id}>
                <time dateTime={new Date(item.created).toISOString()}>{new Date(item.created).toLocaleDateString([], {month:'short',day:'numeric'})}</time>
                <h3><RouteLink href={to.fromSiena()}>{item.title ?? 'From Siena'}</RouteLink></h3>
                <SienaBody text={item.body} />
              </article>
            )) : (
              <>
                <h3>All caught up.</h3>
                <p>I'll leave anything new here as soon as it comes in.</p>
                <img className="empty-puffin" src="/redesign/puffin-right.webp" alt="" />
              </>
            )}
          </section>
          <section className="board-tile board-coming">
            <h2>Reminders</h2>
            {reminders.map((item) => (
              <SienaItemCard key={item.id} item={item} />
            ))}
            {!reminders.length && !familyReminders.length ? <p>Nothing due today.</p> : null}
            {familyReminders.slice(0, 1).map((e) => (
              <a
                key={e.sourceId}
                href={DAVIS_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {e.title}
                <small>Davis · Read only{family.status !== 'ready' ? ' · Stale' : ''}</small>
              </a>
            ))}

            {['stale', 'offline', 'error', 'denied'].includes(family.status) ? (
              <RouteLink className="calendar-source-status" href={to.settings()}>
                Family events {family.snapshot ? 'may be out of date' : 'are unavailable'}.
              </RouteLink>
            ) : null}
          </section>
          <div className="board-links">
          <section className="board-tile board-shelf">
            <div className="board-tile-label">
              <h2>Notebooks</h2>
              <button className="board-add-notebook" aria-label="Add notebook" onClick={() => frame?.manage()}><Icon name="add" /></button>
            </div>
            <div className="board-books">
              {books.map((book, i) => (
                <Spine key={book.id} id={book.id} name={book.name} color={book.color} index={i} />
              ))}
            </div>
          </section>
          <RouteLink className="board-tile board-theology" href={to.theology()}>
            <h2>Theology</h2>
          </RouteLink>
          </div>
        </div>
      </main>
    </div>
  )
}

/* A spine opens its notebook. Held, or right-clicked on a desk, it opens the
   manager on that notebook for a rename or a new cover. The journal is
   reserved, so holding it does nothing more than a tap. */
function Spine({ id, name, color, index }: { id: string; name: string; color: string; index: number }) {
  const frame = useFrame()
  const { fired, ...hold } = useLongPress(() => {
    if (id !== JOURNAL_NOTEBOOK) frame?.manage(id)
  })
  return (
    <RouteLink
      href={to.notebookHome(id)}
      aria-label={`Open ${name} notebook`}
      style={{ backgroundColor: coverColor(color), height: `${100 - (index % 5) * 7}%`, '--book-color': coverColor(color) } as React.CSSProperties}
      {...hold}
      onClick={(e) => {
        if (fired()) e.preventDefault()
      }}
    >
      <strong>{name}</strong>
    </RouteLink>
  )
}
