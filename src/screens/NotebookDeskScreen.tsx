import { useSienaItems } from '../lib/useSienaItems'
import { useEffect, useState } from 'react'
import { DeskHeader, RouteLink } from '../components/DeskHeader'
import { SienaItemCard } from '../components/SienaItemCard'
import { Icon } from '../components/Icon'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'
import { useNotebooks } from '../lib/notebooks'
import { notebookDeskItems, ST_JOHN_NOTEBOOK, hasAccessDetails } from '../lib/notebook-desk'
import { snippetOf, titleOf, type Page } from '../lib/model'
import { clock, isoDay, readableDay, shortStamp } from '../lib/format'
import { shiftDate } from '../lib/event-recurrence'
import { useWorkCalendar, workEvents, type WorkStatus } from '../work-calendar/calendar'
import { scheduleDays } from '../work-calendar/schedule'
import { to } from '../lib/router'
import { setSettings } from '../lib/settings'

const resources = [
  [
    'Training roster',
    'Registrations & sessions',
    'https://app.smartsheet.com/dashboards/xg9CCQRrfPC8gxjv5Jf3cv2JGr2FCGp5RrFhvrq1',
  ],
  [
    'OKTUL',
    'Onboarding worksheet',
    'https://app.smartsheet.com/sheets/gHG8Wwfj599G8c4Qfhwh76p4Q4vcXqh2rFMHCQ71?view=grid',
  ],
  [
    'ServiceNow',
    'Tickets & follow-through',
    'https://ascensionesm.service-now.com/now/sow/home',
  ],
  [
    'Knowledge library',
    'IT reference articles',
    'https://ascensionesm.service-now.com/now/nav/ui/classic/params/target/kb%3Fid%3Dkb_home',
  ],
]

const scheduleNotes: Partial<Record<WorkStatus, string>> = {
  setup: 'Pair this device under Sync to show your work calendar here.',
  loading: 'Loading your work calendar…',
  unavailable: 'The first scheduled work-calendar update has not arrived yet.',
  denied: 'The server didn’t accept this device’s sync key. Check Sync in Settings.',
  error: 'Your work calendar could not be refreshed. This does not mean it is empty.',
  offline: 'You’re offline. These events are from the last time it loaded.',
  stale: 'These events are from the last time it loaded.',
}

const SCHEDULE_DAYS = 14

export function NotebookDeskScreen({ notebook }: { notebook: string }) {
  const books = useNotebooks()
  const book = books.find((book) => book.id === notebook)
  const pages = useLive<Page[]>(() => livePages(notebook), [notebook], [])
  const items = useSienaItems()
  const [now, setNow] = useState(() => new Date())
  const [filter, setFilter] = useState<'due' | 'upcoming' | 'all'>('due')
  const [query, setQuery] = useState('')
  const [visibleActions, setVisibleActions] = useState(6)
  useEffect(() => setVisibleActions(6), [filter])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (book) setSettings({ notebook })
  }, [notebook, book?.id])
  const sections = notebookDeskItems(items, notebook, now)
  const remindersPage = pages.find((page) => page.purpose === 'reminders')
  const notes = pages
    .filter((page) => page.purpose !== 'reminders')
    .sort((a, b) => b.pinned - a.pinned || b.updated - a.updated)
  const shownNotes = notes.filter((page) =>
    page.body.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const work = notebook === ST_JOHN_NOTEBOOK
  /* The work desk adds a full fortnight; Today also includes work appointments
     in both of its calendar columns. */
  const today = isoDay(now.getTime())
  const lastDay = shiftDate(today, SCHEDULE_DAYS - 1)
  const workState = useWorkCalendar(work ? today : undefined, work ? lastDay : undefined)
  const schedule = work
    ? scheduleDays(workEvents(workState, today, lastDay), today, SCHEDULE_DAYS)
    : []
  const scheduleNote = scheduleNotes[workState.status]
  /* Today and the next day with anything on it stay open; the rest of the
     fortnight waits behind one control so the card keeps the desk's measure. */
  const [wholeSchedule, setWholeSchedule] = useState(false)
  const shownDays = wholeSchedule ? schedule : schedule.slice(0, 2)
  const laterDays = schedule.slice(2)
  const laterCount = laterDays.reduce((sum, day) => sum + day.events.length, 0)
  const selected =
    filter === 'all' ? sections.active : filter === 'due' ? sections.due : sections.upcoming
  const featured = sections.briefs[0]
  return (
    <div className="app fn-app notebook-desk-app">
      <main className="notebook-desk scroll">
        <div className="notebook-desk-wrap">
          <DeskHeader title={book?.name ?? 'Notebook desk'} notebook={notebook} />
          {!book ? (
            <p className="work-empty">
              This notebook isn’t available on this device yet.{' '}
              <RouteLink href={to.overview()}>Return to Today</RouteLink>
            </p>
          ) : (
            <>
              <section className="work-cover" aria-label="Notebook overview">
                <div className="work-cover-copy">
                  <span className="work-eyebrow">
                    {work
                      ? 'Ascension St. John · Clinical Informatics'
                      : 'Your notebook, at a glance'}
                  </span>
                  <h2>
                    A little order.
                    <br />
                    <em>Room to think.</em>
                  </h2>
                  <p>
                    {work
                      ? 'Your actions, your notes, and the threads worth keeping close.'
                      : 'Pick up a thread, find a note, and make room for what’s next.'}
                  </p>
                </div>
                <div className="work-counts" aria-label="Open reminder counts">
                  <button onClick={() => setFilter('due')} aria-pressed={filter === 'due'}>
                    <strong>{sections.due.length.toString().padStart(2, '0')}</strong>
                    <span>Due & overdue</span>
                  </button>
                  <button
                    onClick={() => setFilter('upcoming')}
                    aria-pressed={filter === 'upcoming'}
                  >
                    <strong>{sections.upcoming.length.toString().padStart(2, '0')}</strong>
                    <span>Looking ahead</span>
                  </button>
                  <div>
                    <strong>{notes.length.toString().padStart(2, '0')}</strong>
                    <span>Notebook pages</span>
                  </div>
                </div>
              </section>
              <div className="work-grid">
                <div className="work-main">
                  {work ? (
                    <section className="work-schedule" aria-labelledby="work-schedule-heading">
                      <span className="work-paper-tab" aria-hidden="true">
                        Ascension calendar
                      </span>
                      <div className="work-section-heading">
                        <div>
                          <span className="work-eyebrow">Read only · the next two weeks</span>
                          <h2 id="work-schedule-heading">Your schedule</h2>
                        </div>
                      </div>
                      {scheduleNote ? (
                        <p className="work-schedule-note" role="status">
                          {scheduleNote}
                        </p>
                      ) : null}
                      {workState.snapshot
                        ? shownDays.map((day, index) => (
                            <div className="work-schedule-day" key={day.iso}>
                              <h3>
                                {index === 0 ? 'Today · ' : ''}
                                {new Date(`${day.iso}T12:00:00`).toLocaleDateString([], {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </h3>
                              {day.events.length ? (
                                <ul>
                                  {day.events.map((event) => (
                                    <li key={`${event.id}-${day.iso}`}>
                                      <span className="work-schedule-time">
                                        {event.endDate && event.endDate > event.date
                                          ? 'Multi-day'
                                          : clock(event.startTime)
                                            ? `${clock(event.startTime)}${event.endTime ? ` → ${clock(event.endTime)}` : ''}`
                                            : 'All day'}
                                      </span>
                                      <span className="work-schedule-main">
                                        <strong>{event.title}</strong>
                                        {event.endDate && event.endDate > event.date ? (
                                          <small>
                                            {readableDay(event.date)} – {readableDay(event.endDate)}
                                          </small>
                                        ) : null}
                                        {event.location ? <small>{event.location}</small> : null}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="work-empty">Nothing on your work calendar today.</p>
                              )}
                            </div>
                          ))
                        : null}
                      {workState.snapshot && laterDays.length ? (
                        <button
                          className="work-show-more"
                          aria-expanded={wholeSchedule}
                          onClick={() => setWholeSchedule((open) => !open)}
                        >
                          {wholeSchedule
                            ? 'Show less'
                            : `${laterDays.length} more ${laterDays.length === 1 ? 'day' : 'days'} · ${laterCount} ${laterCount === 1 ? 'event' : 'events'}`}{' '}
                          <Icon name="forward" />
                        </button>
                      ) : null}
                    </section>
                  ) : null}
                  <section
                    className="work-actions work-paper"
                    aria-labelledby="work-actions-heading"
                  >
                    <span className="work-paper-tab" aria-hidden="true">
                      01 / Follow through
                    </span>
                    <div className="work-section-heading">
                      <div>
                        <span className="work-eyebrow">One thing at a time</span>
                        <h2 id="work-actions-heading">On your list</h2>
                      </div>
                      {remindersPage ? (
                        <RouteLink
                          className="icon-control"
                          href={to.page(remindersPage.id)}
                          aria-label="Open notebook reminders"
                          title="Open notebook reminders"
                        >
                          <Icon name="forward" />
                        </RouteLink>
                      ) : null}
                    </div>
                    <div className="work-filters" role="group" aria-label="Filter reminders">
                      {(['due', 'upcoming', 'all'] as const).map((value) => (
                        <button
                          key={value}
                          aria-pressed={filter === value}
                          onClick={() => setFilter(value)}
                        >
                          {value === 'due'
                            ? 'Due & overdue'
                            : value === 'upcoming'
                              ? 'Ahead'
                              : 'All open'}{' '}
                          <span>
                            {value === 'due'
                              ? sections.due.length
                              : value === 'upcoming'
                                ? sections.upcoming.length
                                : sections.active.length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="work-action-list" aria-live="polite">
                      {selected.length ? (
                        selected
                          .slice(0, visibleActions)
                          .map((item) => <SienaItemCard key={item.id} item={item} />)
                      ) : (
                        <p className="work-empty">
                          {filter === 'due'
                            ? 'Nothing due here today. You can look ahead or return to your notes.'
                            : 'No open reminders in this view.'}
                        </p>
                      )}
                    </div>
                    {selected.length > visibleActions ? (
                      <button
                        className="work-show-more"
                        onClick={() => setVisibleActions(selected.length)}
                      >
                        Show all {selected.length} reminders <Icon name="forward" />
                      </button>
                    ) : null}
                  </section>
                </div>
                {/* The middle column: the latest word from Siena, then the notebook's pages. */}
                <div className="work-middle">
                  <section
                    className="work-brief work-paper"
                    aria-labelledby="work-brief-heading"
                  >
                    <span className="work-tape" aria-hidden="true" />
                    <RouteLink
                      className="work-section-heading work-brief-head"
                      href={to.fromSiena()}
                      title="From Siena"
                    >
                      <div>
                        <span className="work-eyebrow">02 / The latest word</span>
                        <h2 id="work-brief-heading">From Siena</h2>
                      </div>
                      <Icon name="from-siena" />
                    </RouteLink>
                    {featured ? (
                      <>
                        <p className="work-brief-date">
                          Saved {shortStamp(featured.created)} ·{' '}
                          {featured.seenAt ? 'Seen' : 'Unread'}
                        </p>
                        <SienaItemCard item={featured} paper journal />
                      </>
                    ) : (
                      <p className="work-empty">
                        Work briefs will appear here when saved to this notebook. Older messages
                        can be filed from From Siena.
                      </p>
                    )}
                    {sections.briefs.slice(1).map(item => <div className="work-active-message" key={item.id}><SienaItemCard item={item} paper column /></div>)}
                    <RouteLink className="work-archive-link" href={to.archive(notebook)}>Archive</RouteLink>
                  </section>
                  <section className="work-notes" aria-labelledby="work-notes-heading">
                    <div className="work-section-heading">
                      <div>
                        <span className="work-eyebrow">Keep within reach</span>
                        <h2 id="work-notes-heading">
                          <RouteLink href={to.notebook(notebook)} aria-label="From your notebook — all pages" title="All pages">
                            From your notebook
                          </RouteLink>
                        </h2>
                      </div>
                    </div>
                    <input
                      className="work-search"
                      type="search"
                      aria-label="Find a notebook page"
                      placeholder="Find a page…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <div className="work-note-grid">
                      {shownNotes.slice(0, query ? shownNotes.length : 6).map((page, index) => (
                        <RouteLink
                          className={`work-note work-note-${index % 3}`}
                          key={page.id}
                          href={to.page(page.id)}
                        >
                          <span className="work-note-meta">
                            {page.pinned ? 'Pinned · ' : ''}
                            {shortStamp(page.updated)}
                          </span>
                          <h3>
                            {hasAccessDetails(titleOf(page.body))
                              ? 'Notebook reference'
                              : titleOf(page.body)}
                          </h3>
                          <p>
                            {hasAccessDetails(page.body)
                              ? 'Open this page for its details.'
                              : snippetOf(page.body)}
                          </p>
                          <span className="work-note-open">
                            <Icon name="forward" />
                          </span>
                        </RouteLink>
                      ))}
                    </div>
                    {!shownNotes.length ? (
                      <p className="work-empty">
                        {query
                          ? 'No pages match that search.'
                          : 'Your notebook pages will gather here as you write.'}
                      </p>
                    ) : null}
                  </section>
                </div>
                <aside className="work-side">
                  {work ? (
                    <section
                      className="work-resources"
                      aria-labelledby="work-resources-heading"
                    >
                      <span className="work-eyebrow">03 / Familiar places</span>
                      <h2 id="work-resources-heading">Your work shelf</h2>
                      <div>
                        {resources.map(([label, description, url]) => (
                          <a key={label} href={url} target="_blank" rel="noopener noreferrer">
                            <span>
                              <strong>{label}</strong>
                              <small>{description}</small>
                            </span>
                            <Icon name="source" />
                          </a>
                        ))}
                      </div>
                    </section>
                  ) : null}

                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
