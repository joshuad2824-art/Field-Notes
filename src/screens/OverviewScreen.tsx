import { useEffect, useState } from 'react'
import { EventRow } from '../components/EventRow'
import { Shell } from '../components/Shell'
import { SienaItemCard } from '../components/SienaItemCard'
import { WeatherGlyph } from '../components/WeatherGlyph'
import { weekAhead } from '../lib/agenda'
import { liveEvents } from '../lib/events'
import { livePages } from '../lib/db'
import { isoDay, mastheadParts, readableDay } from '../lib/format'
import { snippetOf, titleOf, type FieldEvent, type Page, type SienaItem } from '../lib/model'
import { pageToRevisit } from '../lib/resurface'
import { navigate, to } from '../lib/router'
import { allSienaItems, sienaSections } from '../lib/siena-items'
import { useLive } from '../lib/useLive'
import { degrees } from '../weather/codes'
import { usePlace } from '../weather/place'
import { useWeather } from '../weather/store'

const dayName = new Intl.DateTimeFormat([], { weekday: 'short' })

export function OverviewScreen({ notebook }: { notebook: string }) {
  const [today, setToday] = useState(isoDay)
  useEffect(() => {
    const timer = window.setInterval(() => setToday(isoDay()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const { weekday, day, month, year } = mastheadParts()
  const allEvents = useLive<FieldEvent[]>(liveEvents, [], [])
  const pages = useLive<Page[]>(livePages, [], [])
  const revisit = pageToRevisit(pages, today)
  const events = allEvents.filter((event) => event.date === today)
  const items = useLive(allSienaItems, [], [])
  const siena = sienaSections(items)
  const upcoming = weekAhead(today, allEvents, items)
  const weather = useWeather()
  const place = usePlace()

  return (
    <div className="app">
      <div className="statusband" />
      <Shell notebook={notebook} overview>
        {({ toggle }) => (
          <main className="overview-screen scroll">
            <div className="overview-wrap">
              <header className="overview-head">
                <div className="overview-top">
                  {toggle}
                  <span className="overview-wordmark">Field Notes</span>
                  <span className="grow" />
                  <button className="overview-text-link" onClick={() => navigate(to.fromSiena())}>
                    From Siena {siena.unseen ? <span className="siena-badge">{siena.unseen}</span> : null}
                  </button>
                </div>
                <div className="overview-date">
                  <span className="overview-weekday">{weekday}</span>
                  <span className="overview-day">{day}</span>
                  <span className="overview-month">{month}<br />{year}</span>
                </div>
                <div className="overview-heading-row">
                  <h1>Today in Field Notes</h1>
                  <div className="overview-actions">
                    <button className="overview-action primary" onClick={() => navigate(to.newPage(notebook))}>New page</button>
                    <button className="overview-action" onClick={() => navigate(to.today())}>Add to today</button>
                    <button className="overview-action" onClick={() => navigate(to.search())}>Search</button>
                  </div>
                </div>
              </header>

              <div className="overview-daily">
                <section className="overview-events">
                  <div className="overview-section-head">
                    <h2>Today’s events</h2>
                    <button className="overview-icon-button overview-add-event" aria-label="Add event" title="Add event" onClick={() => navigate(to.newEvent(today))}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.3 3.5c-.5 5.6-.3 11.5-.5 17" /><path d="M3.8 12.1c5.5-.1 11.3-.2 16.5-.5" /></svg>
                    </button>
                  </div>
                  {events.length ? events.map((event) => <EventRow key={event.id} event={event} />) : (
                    <p className="overview-empty">Nothing planned here today.</p>
                  )}
                  <button className="overview-icon-button overview-open-calendar" aria-label="Open calendar" title="Open calendar" onClick={() => navigate(to.calendar())}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4.1 6.4c4.9-.4 10.8-.2 15.8.1.3 4.5.2 9.7-.2 14.1-5.3.4-10.7.4-15.5-.1-.4-4.7-.4-9.5-.1-14.1zM8 3.6l-.2 4.5M16.4 3.4l.1 4.6M4.4 10.5c4.7.2 10 .2 15.2 0" /><path d="M8.4 14.3c1.6-.2 3.1-.2 4.8-.1M8.7 17.4c1.2-.1 2.5 0 3.7.1" /></svg>
                  </button>
                </section>

                <section className="overview-forecast">
                  <div className="overview-section-head">
                    <h2>The week ahead</h2>
                    {place?.label ? <span className="overview-place">{place.label}</span> : null}
                  </div>
                  {weather?.daily.length ? (
                    <div className="forecast-days">
                      {weather.daily.map((forecast) => {
                        const date = new Date(`${forecast.date}T12:00:00`)
                        const isToday = forecast.date === today
                        return (
                          <div key={forecast.date} className={`forecast-day${isToday ? ' today' : ''}`}>
                            <span className="forecast-weekday">{isToday ? 'Today' : dayName.format(date)}</span>
                            <WeatherGlyph code={forecast.code} isDay />
                            <span className="forecast-range"><strong>{degrees(forecast.high)}</strong> / {degrees(forecast.low)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="overview-empty">The forecast will appear when a place and a weather reading are available.</p>}
                </section>
              </div>

              <section className="overview-upcoming">
                <div className="overview-section-head">
                  <h2>Coming up</h2>
                  <button className="overview-text-link" onClick={() => navigate(to.calendar())}>Calendar ↗</button>
                </div>
                <p className="overview-upcoming-intro">The next seven days</p>
                {upcoming.length ? upcoming.map((entry) => (
                  <div className="overview-agenda-day" key={entry.iso}>
                    <button className="overview-agenda-date" onClick={() => navigate(to.day(entry.iso))}>{readableDay(entry.iso)}</button>
                    <div className="overview-agenda-items">
                      {entry.events.map((event) => <EventRow key={event.id} event={event} />)}
                      {entry.reminders.map((item: SienaItem) => (
                        <button className="overview-agenda-reminder" key={item.id} onClick={() => navigate(to.fromSiena())}>
                          <span className="section-label">Reminder</span>
                          <span>{item.title ?? item.body}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <p className="overview-empty">Nothing else planned in the next seven days.</p>}
              </section>

              {revisit ? <section className="overview-revisit">
                <div className="overview-section-head"><h2>From an earlier page</h2></div>
                <button className="overview-revisit-page" onClick={() => navigate(to.page(revisit.id))}>
                  <span>{titleOf(revisit.body)}</span>
                  {snippetOf(revisit.body) ? <small>{snippetOf(revisit.body)}</small> : null}
                  <em>Open this page ↗</em>
                </button>
              </section> : null}

              <section className="overview-from-siena">
                <div className="overview-section-head">
                  <h2>From Siena {siena.unseen ? <span className="siena-badge">{siena.unseen}</span> : null}</h2>
                  <button className="overview-icon-button" aria-label="All saved items" title="All saved items" onClick={() => navigate(to.fromSiena())}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 6.6c4.7-.4 9.6-.3 14 .1.4 4.1.4 8.8.1 13.1-4.4.4-9.3.5-14.2.1-.4-4.5-.2-9 .1-13.3zM7.8 4.1c2.8-.2 5.8-.2 8.4.1M10 2.1c1.3-.1 2.6-.1 4 0M8.7 11.2c2.4-.2 4.6-.1 6.8.1M8.8 14.7c2.2-.1 4.5-.1 6.3.1" /></svg>
                  </button>
                </div>

                {siena.featured ? <SienaItemCard item={siena.featured} paper /> : (
                  <div className="siena-item paper siena-empty-letter">
                    <span className="section-label">A note from Siena</span>
                    <p>When Siena leaves you a note, its full message will be here. Older notes stay in From Siena.</p>
                  </div>
                )}

                <div className="overview-siena-columns">
                  <div className="overview-siena-section">
                    <div className="overview-section-head"><h3>Reminders</h3></div>
                    {siena.reminders.length ? siena.reminders.map((item) => <SienaItemCard key={item.id} item={item} />) : <p className="overview-empty">Nothing is due from Siena today.</p>}
                  </div>
                  <div className="overview-siena-section">
                    <div className="overview-section-head"><h3>Task updates</h3></div>
                    {siena.updates.length ? siena.updates.map((item) => <SienaItemCard key={item.id} item={item} />) : <p className="overview-empty">No new results or decisions to review.</p>}
                  </div>
                </div>
              </section>
            </div>
          </main>
        )}
      </Shell>
    </div>
  )
}
