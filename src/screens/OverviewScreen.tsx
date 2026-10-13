import { QuickNote } from '../components/QuickNote'
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
import { NotebookManager } from '../components/NotebookManager'
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
  const [today, setToday] = useState(isoDay),
    [manage, setManage] = useState(false),
    [quick, setQuick] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setToday(isoDay()), 60000)
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
  const quotes = [
    'Leave a little room in the day for something you didn’t plan.',
    'A small beginning is still a beginning.',
    'Some things become clearer when you put them on paper.',
    'Pay attention to the ordinary things you’ll want to remember.',
    'There is time to do one thing with care.',
    'A quiet day can hold a good deal of life.',
    'Keep a place for the work that matters to you.',
  ]
  const quote = quotes[Math.floor(Date.parse(today + 'T12:00:00Z') / 86400000) % quotes.length]
  return (
    <div className="app board-app">
      {quick ? <QuickNote onClose={() => setQuick(false)} /> : null}
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
              <section>
                <h2>{events.length ? 'Schedule' : 'Quote'}</h2>
                {events.length ? (
                  events.slice(0, 3).map((e) => <EventRow key={e.id} event={e} />)
                ) : (
                  <div className="quiet-day">
                    <blockquote>{quote}</blockquote>
                    <cite>Siena</cite>
                  </div>
                )}
                {events.length > 3 ? (
                  <RouteLink href={to.day(today)} className="board-more">
                    {events.length - 3} more
                  </RouteLink>
                ) : null}
              </section>
              <section className="board-current-weather">
                <BoardWeather />
              </section>
              <BoardWeather compact />
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
            <div className="board-month-today">
              <h2>Coming up</h2>
              {upcoming.length ? (
                upcoming.slice(0, 4).map((entry) => (
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
              ) : (
                <p>Nothing in the next several days.</p>
              )}
            </div>
          </section>
          <section className="board-tile board-weather-tile">
            <button
              className="quick-note-open"
              onClick={() => setQuick(true)}
              aria-label="Quick note"
            >
              <Icon name="edit" />
              <strong>Quick note</strong>
              <small>A thought to keep</small>
            </button>
          </section>
          <RouteLink className="board-tile board-date" href={to.calendar(month)}>
            <strong>{date.toLocaleDateString([], { weekday: 'short' })}</strong>
            <span>
              {date.getDate()} {date.toLocaleDateString([], { month: 'short' })}
            </span>
          </RouteLink>
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
                    <small>{letter}</small>
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
              <button onClick={() => setManage(true)}>Manage</button>
            </div>
            <div className="board-books">
              {books.map((book, i) => (
                <RouteLink
                  key={book.id}
                  href={to.notebookHome(book.id)}
                  aria-label={`Open ${book.name} notebook`}
                  style={{
                    backgroundColor: coverColor(book.color),
                    height: `${100 - (i % 5) * 7}%`,
                  }}
                >
                  <strong>{book.name}</strong>
                  <small>{pages.filter((p) => p.notebook === book.id).length}</small>
                </RouteLink>
              ))}
              <button aria-label="Add notebook" onClick={() => setManage(true)}>
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
      {manage ? (
        <NotebookManager
          onClose={() => setManage(false)}
          onAdded={(id) => navigate(to.notebook(id))}
          onDeleted={() => {}}
        />
      ) : null}
    </div>
  )
}
