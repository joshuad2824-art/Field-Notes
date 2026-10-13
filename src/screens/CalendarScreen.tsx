import { DAVIS_SOURCE_URL } from '../davis/wire'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { eventOnDay } from '../lib/event-range'
import { Icon } from '../components/Icon'
import { MonthGrid } from '../components/MonthGrid'
import { EventRow } from '../components/EventRow'
import { PageRow } from '../components/PageRow'
import { useCalendarView, selectCalendarDate } from '../lib/calendar-view'
import { eventsInMonth } from '../lib/events'
import { pagesInMonth } from '../lib/db'
import { dayOf, monthNow, monthParts, monthOf, stepMonth } from '../lib/calendar'
import { isoDay, readableDay, clock } from '../lib/format'
import { JOURNAL_NOTEBOOK } from '../lib/model'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
export function CalendarScreen({ notebook: _notebook }: { month?: string; notebook: string }) {
  const { month: shown, selected } = useCalendarView()
  const pages = useLive(() => pagesInMonth(shown), [shown], []),
    localEvents = useLive(() => eventsInMonth(shown), [shown], []),
    family = useFamilyAgenda()
  const events = mergeCalendarEvents(
      localEvents,
      family,
      `${shown}-01`,
      monthOf(shown)[41].iso,
    ),
    parts = monthParts(shown),
    days = monthOf(shown)
  // Keep the sixth row only when the actual month needs it.
  const cells = days[35].inMonth ? days : days.slice(0, 35)
  const choose = (iso: string) => {
    selectCalendarDate(iso)
  }
  return (
    <div className="app month-app">
      <main className="month-screen scroll">
        <header className="month-header">
          <div>
            <h1 id="desk-heading">
              {parts.month} <span>{parts.year}</span>
            </h1>
            <p>
              {pages.length} pages · {events.length} events this month
            </p>
          </div>
          <div className="month-controls">
            <button
              aria-label="Previous month"
              onClick={() => navigate(to.calendar(stepMonth(shown, -1)))}
            >
              ‹
            </button>
            <button
              onClick={() => {
                choose(isoDay())
                navigate(to.calendar(monthNow()))
              }}
            >
              Today
            </button>
            <button
              aria-label="Next month"
              onClick={() => navigate(to.calendar(stepMonth(shown, 1)))}
            >
              ›
            </button>
          </div>
        </header>
        <div className="month-desktop">
          <div className="month-weekdays">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
              (d) => (
                <span key={d}>{d}</span>
              ),
            )}
          </div>
          <div className="month-cells">
            {cells.map((day) => {
              const daily = events.filter((e) => eventOnDay(e, day.iso)),
                written = pages.filter((p) => dayOf(p) === day.iso)
              return (
                <section
                  key={day.iso}
                  className={`month-cell${!day.inMonth ? ' outside' : ''}${day.iso === selected ? ' selected' : ''}`}
                >
                  <div className="month-cell-head">
                    <button
                      className={day.iso === isoDay() ? 'today' : ''}
                      aria-label={day.iso}
                      onClick={() => navigate(to.day(day.iso))}
                    >
                      {day.date}
                    </button>
                    {written.length ? (
                      <button onClick={() => choose(day.iso)}>{written.length} pages</button>
                    ) : null}
                  </div>
                  {daily.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      className={`month-event ${e.calendarTarget === 'Family' ? 'family' : ''}`}
                      onClick={() =>
                        e.externalSource === 'davis'
                          ? window.open(DAVIS_SOURCE_URL, '_blank', 'noopener,noreferrer')
                          : navigate(to.event(e.seriesId ?? e.id, e.occurrenceDate))
                      }
                    >
                      <strong>{e.title}</strong>
                      <small>{clock(e.startTime) || 'All day'}</small>
                    </button>
                  ))}
                  {daily.length > 3 ? (
                    <button
                      className="month-overflow"
                      onClick={() => navigate(to.day(day.iso))}
                    >
                      {daily.length - 3} more
                    </button>
                  ) : null}
                </section>
              )
            })}
          </div>
        </div>
        <div className="month-mobile">
          <MonthGrid
            month={shown}
            selected={selected}
            written={new Set(pages.filter((p) => p.notebook !== JOURNAL_NOTEBOOK).map(dayOf))}
            events={
              new Set(
                cells.filter((d) => events.some((e) => eventOnDay(e, d.iso))).map((d) => d.iso),
              )
            }
            onPick={choose}
          />
        </div>
        <section className="month-selected">
          <button
            className="day-agenda-link"
            aria-label="Open selected day agenda"
            onClick={() => navigate(to.day(selected))}
          >
            <Icon name="list" />
            Day agenda
          </button>
          <h2>
            {readableDay(selected)}
            {selected === isoDay() ? ' · Today' : ''}
          </h2>
          {events
            .filter((e) => eventOnDay(e, selected))
            .map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          <div className="rows">
            {pages
              .filter((p) => dayOf(p) === selected)
              .map((p) => (
                <PageRow key={p.id} page={p} showNotebook />
              ))}
          </div>
          {!events.some((e) => eventOnDay(e, selected)) &&
          !pages.some((p) => dayOf(p) === selected) ? (
            <p>Nothing on this day yet.</p>
          ) : null}
          <button className="cream-button" onClick={() => navigate(to.newEvent(selected))}>
            <Icon name="add" />
            Add event
          </button>
        </section>
      </main>
    </div>
  )
}
