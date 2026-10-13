import { useWorkCalendar } from '../work-calendar/calendar'
import { TitleChevron } from '../components/NotebookSwitcher'
import { DAVIS_SOURCE_URL } from '../davis/wire'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { useAppleCalendar } from '../apple/calendar'
import { eventOnDay } from '../lib/event-range'
import { MonthGrid } from '../components/MonthGrid'
import { EventRow } from '../components/EventRow'
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
    family = useFamilyAgenda(),
    apple = useAppleCalendar(`${shown}-01`, monthOf(shown)[41].iso),
    work = useWorkCalendar(`${shown}-01`, monthOf(shown)[41].iso)
  const events = mergeCalendarEvents(
      localEvents,
      family,
      `${shown}-01`,
      monthOf(shown)[41].iso,
      apple, work,
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
          <div className="month-title">
            {/* The month's name is the switch: month ⇄ the selected day's agenda. */}
            <h1 id="desk-heading">
              <button
                className="month-toggle"
                onClick={() => navigate(to.day(selected))}
                title="Day agenda"
                aria-label={`${parts.month} ${parts.year} — open the day agenda`}
              >
                {parts.month} <span>{parts.year}</span>
                <TitleChevron />
              </button>
            </h1>
            <div className="month-controls">
              <button
                aria-label="Previous month"
                title="Previous month"
                onClick={() => navigate(to.calendar(stepMonth(shown, -1)))}
              >
                ‹
              </button>
              <button
                aria-label="Next month"
                title="Next month"
                onClick={() => navigate(to.calendar(stepMonth(shown, 1)))}
              >
                ›
              </button>
              {shown !== monthNow() ? (
                <button
                  className="month-today"
                  onClick={() => {
                    choose(isoDay())
                    navigate(to.calendar(monthNow()))
                  }}
                >
                  Today
                </button>
              ) : null}
            </div>
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
              const daily = events.filter((e) => eventOnDay(e, day.iso))
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
                  </div>
                  {/* Two and a count: three no longer fit a cell once the
                      pill has its lane. */}
                  {daily.slice(0, 2).map((e) => (
                    <button
                      key={e.id}
                      className={`month-event ${e.calendarTarget === 'Family' ? 'family' : ''}${e.externalSource === 'apple' ? ' apple' : ''}`}
                      onClick={() =>
                        e.externalSource === 'davis'
                          ? window.open(DAVIS_SOURCE_URL, '_blank', 'noopener,noreferrer')
                          : (e.externalSource === 'apple' || e.externalSource === 'work')
                            ? navigate(to.day(day.iso))
                            : navigate(to.event(e.seriesId ?? e.id, e.occurrenceDate))
                      }
                    >
                      <strong>{e.title}</strong>
                      <small>{clock(e.startTime) || 'All day'}</small>
                    </button>
                  ))}
                  {daily.length > 2 ? (
                    <button
                      className="month-overflow"
                      onClick={() => navigate(to.day(day.iso))}
                    >
                      {daily.length - 2} more
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
          <h2>
            {readableDay(selected)}
            {selected === isoDay() ? ' · Today' : ''}
          </h2>
          {events
            .filter((e) => eventOnDay(e, selected))
            .map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          {/* The day's pages no longer follow its events here (October 13,
              third pass): the sheet is the day's schedule. They are a tap
              away on the day agenda, and the month's rings still mark them. */}
        </section>
      </main>
    </div>
  )
}
