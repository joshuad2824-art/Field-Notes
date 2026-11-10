import { useSienaItems } from '../lib/useSienaItems'
import { useWorkCalendar } from '../work-calendar/calendar'
import { useFrame } from '../components/ApprovedFrame'
import { useLongPress } from '../lib/long-press'
import { ST_JOHN_NOTEBOOK } from '../lib/notebook-desk'
import { activeSienaItems } from '../lib/siena-archive'
import { useEffect, useState } from 'react'
import { useOverflow } from '../lib/use-overflow'
import { markSienaItemSeen } from '../lib/siena-items'
import type { SienaItem } from '../lib/model'
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
  /* From Siena on Today (November 2026): the newest unread note in full, every
     other unread one as a headline, and the ones already read as a count — so
     the tile has a length that doesn't grow with the inbox, and nothing
     unread is ever out of sight. Seen is still only ever an explicit act. */
  const unread = messages.filter((item) => !item.seenAt)
  const featured = unread[0]
  /* Every other open note, unread first, one line each. A read note that is
     still open is a decision not yet made, so it stays here too. */
  const headlines = [...unread.slice(1), ...messages.filter((item) => item.seenAt)]
  const single = Boolean(events.length) !== Boolean(upcoming.length)
  const [sienaRef, sienaMore] = useOverflow<HTMLElement>(unread.map((item) => item.id).join('|'))
  const [remRef, remMore] = useOverflow<HTMLElement>(reminders.map((item) => `${item.id}:${item.updated}`).join('|'))
  const [todayRef, todayMore] = useOverflow<HTMLElement>(events.map((e) => e.id).join('|'))
  const [comingRef, comingMore] = useOverflow<HTMLElement>(upcoming.map((d) => d.iso + d.events.length).join('|'))
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
            <div className={`day-content${single ? ' is-single' : ''}`}>
              {!events.length && !upcoming.length ? (
                <p className="board-day-quiet">Nothing on the calendar this week.</p>
              ) : null}
              {events.length ? (
                <section ref={todayRef} className={`board-today-schedule${todayMore ? ' has-more' : ''}`}>
                  <h2>Today</h2>
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </section>
              ) : null}
              {/* Only dates with events, and no heading over nothing. */}
              {upcoming.length ? (
              <section ref={comingRef} className={`board-day-coming${comingMore ? ' has-more' : ''}`}>
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
            className={`board-tile board-siena${sienaMore ? ' has-more' : ''}${featured ? '' : ' is-caught-up'}`}
            tabIndex={0}
            aria-label="From Siena"
          >
            <div className="board-tile-label">
              <h2><RouteLink href={to.fromSiena()}>From Siena</RouteLink></h2>
              {unread.length ? <span className="board-badge">{unread.length} new</span> : null}
            </div>
            {featured ? (
              <article className="board-message" key={featured.id}>
                <div className="board-message-top">
                  <time dateTime={new Date(featured.created).toISOString()}>{shortDay(featured.created)}</time>
                  <button
                    className="icon-control board-message-seen"
                    aria-label="Mark seen"
                    title="Mark seen"
                    onClick={() => void markSienaItemSeen(featured.id)}
                  >
                    <Icon name="unseen" />
                  </button>
                </div>
                <h3><RouteLink href={sienaHref(featured)}>{featured.title ?? 'From Siena'}</RouteLink></h3>
                <SienaBody text={featured.body} />
              </article>
            ) : (
              <div className="board-caught-up">
                <h3>All caught up.</h3>
                <p>I'll leave anything new here as soon as it comes in.</p>
                <img className="empty-puffin" src="/redesign/puffin-right.webp" alt="" />
              </div>
            )}
            {headlines.length ? (
              <ul className="board-headlines" aria-label="More from Siena">
                {headlines.map((item) => (
                  <li key={item.id} className={item.seenAt ? 'is-read' : undefined}>
                    <RouteLink href={sienaHref(item)}>
                      <time dateTime={new Date(item.created).toISOString()}>{shortDay(item.created)}</time>
                      <span>{item.title ?? firstWords(item.body)}</span>
                    </RouteLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section ref={remRef} className={`board-tile board-coming${remMore ? ' has-more' : ''}`}>
            <h2><RouteLink href={to.reminders()}>Reminders</RouteLink></h2>
            {reminders.map((item) => (
              <SienaItemCard key={item.id} item={item} />
            ))}
            {!reminders.length && !familyReminders.length ? <p>Nothing to remember right now.</p> : null}
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
            <RouteLink className="board-more" href={to.reminders()}>
              All reminders <Icon name="forward" />
            </RouteLink>
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

const shortDay = (at: number) => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' })

/* Straight to the note in From Siena, not just to the room. */
const sienaHref = (item: SienaItem) => `${to.fromSiena()}#siena-${item.id}`

function firstWords(text: string): string {
  const line = text.replace(/[#*_>`=]+/g, ' ').trim().split('\n')[0].trim()
  return line.length > 90 ? line.slice(0, 89) + '…' : line
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
