import { useEffect, useState } from 'react'
import { eventOnDay } from '../lib/event-range'
import { EventRow } from '../components/EventRow'
import { SienaItemCard } from '../components/SienaItemCard'
import { DavisAgenda } from '../components/DavisAgenda'
import { DeskHeader, RouteLink } from '../components/DeskHeader'
import { DeskWeather } from '../components/DeskWeather'
import { DeskJournal } from '../components/DeskJournal'
import { ProjectDesk } from '../components/ProjectDesk'
import { Icon } from '../components/Icon'
import { weekAhead } from '../lib/agenda'
import { liveEvents } from '../lib/events'
import { livePages } from '../lib/db'
import { isoDay, readableDay } from '../lib/format'
import { type Page, type FieldEvent } from '../lib/model'
import { to } from '../lib/router'
import { allSienaItems, sienaSections } from '../lib/siena-items'
import { projectDesk } from '../lib/project-desk'
import { useLive } from '../lib/useLive'

export function OverviewScreen({ notebook }: { notebook: string }) {
  const [today, setToday] = useState(isoDay)
  useEffect(() => { const timer = window.setInterval(() => setToday(isoDay()), 60_000); return () => window.clearInterval(timer) }, [])
  const pages = useLive<Page[]>(livePages, [], [])
  const allEvents = useLive<FieldEvent[]>(liveEvents, [], [])
  const items = useLive(allSienaItems, [], [])
  const siena = sienaSections(items)
  const upcoming = weekAhead(today, allEvents, items)
  const events = allEvents.filter(event => eventOnDay(event, today))
  const active = projectDesk(pages).active[0]
  return <div className="app fn-app"><main className="overview-screen fn-shell scroll"><div className="overview-wrap">
    <DeskHeader title="At the desk." notebook={notebook} pages={pages} />
    <DeskWeather />
    <div className="fn-desk-grid">
      <div className="fn-main-column">
        <DeskJournal note={siena.featured} project={active} unseen={siena.unseen} />
        <ProjectDesk pages={pages} notebook={notebook} />
      </div>
      <aside className="fn-side-column"><section className="fn-open-reminder"><span className="fn-reminder-tape" aria-hidden="true" /><div className="fn-open-heading"><h2>Remember</h2></div>
        <div className="fn-reminder-items" tabIndex={0} role="region" aria-label="Due reminders">
        {siena.reminders.length ? siena.reminders.map(item => <SienaItemCard key={item.id} item={item} />) : <p className="desk-empty">Nothing is due here today.</p>}
        </div>
      </section>{siena.updates.length ? <section className="desk-updates"><h2>Task updates</h2>{siena.updates.map(item => <SienaItemCard key={item.id} item={item} />)}</section> : null}</aside>
    </div>
    <div className="desk-agenda-row"><DavisAgenda /><div className="desk-local-agenda">
      <section className="overview-events"><div className="overview-section-head"><h2>Today’s events</h2><RouteLink className="overview-icon-button overview-add-event" href={to.newEvent(today)} aria-label="Add event" title="Add event"><Icon name="new-page" /></RouteLink></div>{events.length ? events.map(event => <EventRow key={event.id} event={event} />) : <p className="overview-empty">Nothing planned here today.</p>}</section>
      {upcoming.length ? <section className="overview-upcoming"><h2>Coming up</h2>{upcoming.map(entry => <div className="overview-agenda-day" key={entry.iso}><RouteLink className="overview-agenda-date" href={to.day(entry.iso)}>{readableDay(entry.iso)}</RouteLink><div className="overview-agenda-items">{entry.events.map(event => <EventRow key={event.id} event={event} />)}{entry.reminders.map(item => <RouteLink className="overview-agenda-reminder" key={item.id} href={to.fromSiena()}>{item.title ?? item.body}</RouteLink>)}</div></div>)}</section> : null}
    </div></div>
  </div></main></div>
}
