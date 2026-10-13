import { useFrame } from '../components/ApprovedFrame'
import { useLongPress } from '../lib/long-press'
import { countdownLabel, nextTimed } from '../lib/countdown'
import { planProgress } from '../lib/plan-progress'
import { useEffect, useState } from 'react'
import { shiftDate } from '../lib/event-recurrence'
import { eventOnDay } from '../lib/event-range'
import { EventRow } from '../components/EventRow'
import { SienaItemCard } from '../components/SienaItemCard'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { DAVIS_SOURCE_URL } from '../davis/wire'
import { RouteLink } from '../components/DeskHeader'
import { BoardWeather } from '../components/BoardWeather'
import { MonthGrid } from '../components/MonthGrid'
import { Icon } from '../components/Icon'
import { weekAhead } from '../lib/agenda'
import { liveEvents } from '../lib/events'
import { livePages } from '../lib/db'
import { isoDay } from '../lib/format'
import { dayOf, monthParts, WEEKDAY_LETTERS } from '../lib/calendar'
import { JOURNAL_NOTEBOOK, titleOf, stripMarkers } from '../lib/model'
import { useAllNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { field, projectDesk } from '../lib/project-desk'
import { navigate, to } from '../lib/router'
import { allSienaItems, sienaSections } from '../lib/siena-items'
import { useLive } from '../lib/useLive'
export function OverviewScreen({ notebook: _notebook }: { notebook: string }) {
  const [today, setToday] = useState(isoDay)
  const [now, setNow] = useState(() => Date.now())
  const frame = useFrame()
  /* Once a minute: the date can turn over and the countdown moves on. */
  useEffect(() => {
    const timer = setInterval(() => {
      setToday(isoDay())
      setNow(Date.now())
    }, 60000)
    return () => clearInterval(timer)
  }, [])
  const pages = useLive(livePages, [], []),
    localEvents = useLive(liveEvents, [], []),
    family = useFamilyAgenda(),
    items = useLive(allSienaItems, [], []),
    books = useAllNotebooks()
  const month = today.slice(0, 7),
    date = new Date(today + 'T12:00:00'),
    { month: monthName, year } = monthParts(month)
  const allEvents = mergeCalendarEvents(
      localEvents,
      family,
      `${month}-01`,
      shiftDate(`${month}-28`, 20),
    ),
    events = allEvents.filter((e) => eventOnDay(e, today)),
    siena = sienaSections(items),
    upcoming = weekAhead(today, allEvents, items).filter((entry) => entry.events.length)
  const written = new Set(pages.filter((p) => p.notebook !== JOURNAL_NOTEBOOK).map(dayOf)),
    marked = new Set(
      allEvents.flatMap((e) =>
        Array.from({ length: 62 }, (_, i) => shiftDate(`${month}-01`, i)).filter((d) =>
          eventOnDay(e, d),
        ),
      ),
    )
  const reminders = [...siena.reminders].sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0)),
    familyReminders = (family.snapshot?.entries ?? []).filter((e) => e.kind === 'reminder')
  const plan = projectDesk(pages).plans[0]?.[0],
    { total, done } = planProgress(plan?.body)
  const weekStart = today
  const next = nextTimed(allEvents, now)
  return (
    <div className="app board-app">
      <main className="board-screen scroll">
        <header className="board-header">
          <h1 id="desk-heading">Field Notes</h1>
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
          <section className="board-tile board-day">
            <RouteLink className="day-spine" href={to.calendar(month)}>
              <span>
                {date.toLocaleDateString([], { weekday: 'long' })} <b>{date.getDate()}</b>{' '}
                {monthName}
              </span>
            </RouteLink>
            <div className="day-content">
              {events.length ? (
                <section className="board-today-schedule">
                  <h2>Today's Schedule</h2>
                  {events.slice(0, 3).map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                  {events.length > 3 ? (
                    <RouteLink href={to.day(today)} className="board-more">
                      {events.length - 3} more
                    </RouteLink>
                  ) : null}
                </section>
              ) : null}
              <div className="board-day-coming">
                <h2>Coming up</h2>
                {upcoming.length
                  ? upcoming.slice(0, 4).map((entry) => (
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
              </div>
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
              <Icon name="edit" />
              <strong>Quick note</strong>
            </button>
          </section>
          {next ? (
            next.event.externalSource === 'davis' ? (
              <a
                className="board-tile board-date board-countdown"
                href={DAVIS_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{countdownLabel(next.at - now)}</strong>
                <span>until</span>
                <em>{next.event.title}</em>
              </a>
            ) : (
              <RouteLink
                className="board-tile board-date board-countdown"
                href={to.event(next.event.seriesId ?? next.event.id, next.event.occurrenceDate)}
              >
                <strong>{countdownLabel(next.at - now)}</strong>
                <span>until</span>
                <em>{next.event.title}</em>
              </RouteLink>
            )
          ) : (
            <RouteLink className="board-tile board-date" href={to.calendar(month)}>
              <strong>{date.toLocaleDateString([], { weekday: 'short' })}</strong>
              <span>
                {date.getDate()} {date.toLocaleDateString([], { month: 'short' })}
              </span>
            </RouteLink>
          )}
          <RouteLink className="board-tile board-siena" href={to.fromSiena()}>
            <div className="board-tile-label">
              <h2>From Siena</h2>
              {siena.unseen ? <span className="board-badge">{siena.unseen} new</span> : null}
            </div>
            {siena.featured ? (
              <>
                <h3>{siena.featured.title ?? 'A note for today'}</h3>
                <p>{stripMarkers(siena.featured.body)}</p>
              </>
            ) : (
              <>
                <h3>All caught up.</h3>
                <p>I'll leave anything new here as soon as it comes in.</p>
                <img className="empty-puffin" src="/redesign/puffin-right.webp" alt="" />
              </>
            )}
          </RouteLink>
          <section className="board-tile board-week">
            <h2>Next two weeks</h2>
            <div className="week-strip">
              {Array.from({ length: 14 }, (_, i) => {
                const letter = WEEKDAY_LETTERS[(date.getDay() + i) % 7]
                const d = shiftDate(weekStart, i)
                return (
                  <RouteLink key={d} href={to.day(d)}>
                    {i < 7 ? <small>{letter}</small> : null}
                    <span
                      className={`${written.has(d) ? 'written ' : ''}${marked.has(d) ? 'has-event ' : ''}${today === d ? 'today' : ''}`}
                    >
                      {Number(d.slice(-2))}
                    </span>
                  </RouteLink>
                )
              })}
            </div>
          </section>
          <section className="board-tile board-coming">
            <h2>Remember</h2>
            {reminders.slice(0, 6).map((item) => (
              <SienaItemCard key={item.id} item={item} />
            ))}
            {reminders.length > 6 ? (
              <RouteLink className="board-more" href={to.fromSiena()}>
                All {reminders.length} reminders
              </RouteLink>
            ) : null}
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
          <section className="board-tile board-shelf">
            <div className="board-tile-label">
              <h2>Notebooks</h2>
            </div>
            <div className="board-books">
              {books.map((book, i) => (
                <Spine key={book.id} id={book.id} name={book.name} color={book.color} index={i} />
              ))}
              <button aria-label="Add notebook" onClick={() => frame?.manage()}>
                <Icon name="add" />
              </button>
            </div>
          </section>
          <RouteLink
            className="board-tile board-workshop"
            href={plan ? to.plan(plan.id) : to.workshop()}
          >
            <h2>Workshop</h2>
            <h3>
              {plan
                ? field(plan.body, 'Project') || titleOf(plan.body)
                : 'The next thing to make.'}
            </h3>
            <p>
              {plan
                ? field(plan.body, 'Next step') || 'Open the plan'
                : 'Plans, tools, and work in progress.'}
            </p>
            {total ? (
              <>
                <progress max={total} value={done} />
                <small>
                  {done} of {total} steps
                </small>
              </>
            ) : null}
          </RouteLink>
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
      style={{ backgroundColor: coverColor(color), height: `${100 - (index % 5) * 7}%` }}
      {...hold}
      onClick={(e) => {
        if (fired()) e.preventDefault()
      }}
    >
      <strong>{name}</strong>
    </RouteLink>
  )
}
