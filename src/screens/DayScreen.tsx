import { useEffect, useRef, useState } from 'react'
import { eventOnDay } from '../lib/event-range'
import { shiftDate } from '../lib/event-recurrence'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { livePages } from '../lib/db'
import { isoDay, readableDay } from '../lib/format'
import { dayOf } from '../lib/calendar'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'
import { EventRow } from '../components/EventRow'
import { SienaItemCard } from '../components/SienaItemCard'
import { BoardWeather } from '../components/BoardWeather'
import { Icon } from '../components/Icon'
import { liveEvents } from '../lib/events'
import { allSienaItems } from '../lib/siena-items'
export function DayScreen({ iso }: { iso: string; notebook: string }) {
  const [detail, setDetail] = useState(false),
    [selected, setSelected] = useState(iso),
    [count, setCount] = useState(21),
    [monthLabel, setMonthLabel] = useState(iso),
    rail = useRef<HTMLDivElement>(null)
  const pages = useLive(livePages, [], []),
    localEvents = useLive(liveEvents, [], []),
    items = useLive(allSienaItems, [], []),
    family = useFamilyAgenda()
  const days = Array.from({ length: count }, (_, i) => shiftDate(iso, i)),
    events = mergeCalendarEvents(localEvents, family, iso, days[days.length - 1])
  const reminders = (date: string) =>
    items.filter(
      (i) => i.type === 'reminder' && !i.completedAt && i.dueAt && isoDay(i.dueAt) === date,
    )
  useEffect(() => {
    const el = rail.current
    if (!el) return
    const scroll = () => {
      const top = el.getBoundingClientRect().top
      const row = Array.from(el.querySelectorAll<HTMLElement>('[data-day]')).find(
        (r) => r.getBoundingClientRect().bottom > top + 16,
      )
      if (row?.dataset.day) setMonthLabel(row.dataset.day)
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) setCount((n) => n + 14)
    }
    el.addEventListener('scroll', scroll)
    return () => el.removeEventListener('scroll', scroll)
  }, [])
  const date = new Date(selected + 'T12:00:00')
  return (
    <div className="app agenda-app">
      <main className="agenda-layout">
        <div className="agenda-month-label">
          {new Date(monthLabel + 'T12:00:00').toLocaleDateString([], {
            year: 'numeric',
            month: 'long',
          })}
        </div>
        <div className="agenda-days scroll" ref={rail}>
          {days.map((day) => {
            const daily = events.filter((e) => eventOnDay(e, day)),
              rs = reminders(day)
            return (
              <section key={day} data-day={day} className="agenda-day">
                <div className="agenda-date">
                  <button
                    className={day === isoDay() ? 'today' : ''}
                    onClick={() => {
                      setSelected(day)
                      setDetail(true)
                    }}
                    aria-label={readableDay(day)}
                  >
                    <span>
                      {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })}
                    </span>
                    <strong>{Number(day.slice(-2))}</strong>
                  </button>
                </div>
                <div className={`agenda-band${daily.length + rs.length > 2 ? ' crowded' : ''}`}>
                  {daily.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                  {rs.map((i) => (
                    <button
                      className="agenda-reminder"
                      key={i.id}
                      onClick={() => navigate(to.fromSiena())}
                    >
                      <strong>{i.title ?? i.body}</strong>
                      <small>Reminder</small>
                    </button>
                  ))}
                  {daily.length + rs.length > 2 ? (
                    <button
                      className="agenda-more"
                      onClick={() => {
                        setSelected(day)
                        setDetail(true)
                      }}
                    >
                      <strong>{daily.length + rs.length - 1} more</strong>
                      <span>
                        {[...daily.map((e) => e.title), ...rs.map((i) => i.title ?? i.body)]
                          .slice(1)
                          .join(' · ')}
                      </span>
                    </button>
                  ) : null}
                  {!daily.length && !rs.length ? (
                    <button
                      className="agenda-free"
                      onClick={() => {
                        setSelected(day)
                        setDetail(true)
                      }}
                    >
                      An open day
                    </button>
                  ) : null}
                  <button
                    className="agenda-day-open"
                    onClick={() => {
                      setSelected(day)
                      setDetail(true)
                    }}
                    aria-label={`View ${readableDay(day)}`}
                  >
                    <Icon name="forward" />
                  </button>
                </div>
              </section>
            )
          })}
        </div>
        <aside className={`agenda-sheet scroll${detail ? ' is-open' : ''}`}>
          <button
            className="agenda-sheet-close"
            aria-label="Back to agenda"
            onClick={() => setDetail(false)}
          >
            <Icon name="back" />
          </button>
          <header>
            <h1 id="desk-heading">{date.toLocaleDateString([], { weekday: 'long' })}</h1>
            <p>
              {date.toLocaleDateString([], { day: 'numeric', month: 'long' })}
              {selected === isoDay() ? ' · Today' : ''}
            </p>
            <button aria-label="Add event" onClick={() => navigate(to.newEvent(selected))}>
              <Icon name="add" />
            </button>
          </header>
          <h2>Schedule</h2>
          <section>
            {events
              .filter((e) => eventOnDay(e, selected))
              .map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            {!events.some((e) => eventOnDay(e, selected)) ? (
              <p>Nothing on the calendar.</p>
            ) : null}
          </section>
          <h2>Weather</h2>
          <BoardWeather compact />
          <h2>Remember</h2>
          <section>
            {reminders(selected).map((i) => (
              <SienaItemCard key={i.id} item={i} />
            ))}
            {!reminders(selected).length ? <p>Nothing due on this day.</p> : null}
          </section>
          <h2>Written today</h2>
          <section className="agenda-written">
            {pages
              .filter((p) => dayOf(p) === selected)
              .map((p) => (
                <PageRow key={p.id} page={p} showNotebook />
              ))}
            {!pages.some((p) => dayOf(p) === selected) ? (
              <button onClick={() => navigate(to.today())}>Open today's page</button>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  )
}
