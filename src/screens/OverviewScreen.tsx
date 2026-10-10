import { shiftDate } from '../lib/event-recurrence'
import { useEffect, useState } from 'react'
import { eventOnDay } from '../lib/event-range'
import { EventRow } from '../components/EventRow'
import { SienaItemCard } from '../components/SienaItemCard'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { DAVIS_SOURCE_URL } from '../davis/wire'
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
import { useLive } from '../lib/useLive'

export function OverviewScreen({ notebook }: { notebook: string }) {
  const [today, setToday] = useState(isoDay)
  useEffect(() => { const timer = window.setInterval(() => setToday(isoDay()), 60_000); return () => window.clearInterval(timer) }, [])
  const pages = useLive<Page[]>(livePages, [], [])
  const localEvents = useLive<FieldEvent[]>(liveEvents, [], [])
  const family = useFamilyAgenda()
  const allEvents = mergeCalendarEvents(localEvents, family, today, shiftDate(today, 7))
  const familyReminders = (family.snapshot?.entries ?? []).filter(entry => entry.kind === 'reminder')
  const items = useLive(allSienaItems, [], [])
  const siena = sienaSections(items)
  const upcoming = weekAhead(today, allEvents, items)
  const events = allEvents.filter(event => eventOnDay(event, today))
  const reminderPreview = [...siena.reminders].sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0)).slice(0, 4)
  return <div className="app fn-app dashboard-app"><main className="overview-screen fn-shell scroll"><div className="overview-wrap">
    <DeskHeader title="At the desk." notebook={notebook} pages={pages} />
    <DeskWeather />
    <div className="dashboard-priority">
      <DeskJournal note={siena.featured} events={events} today={today} unseen={siena.unseen} />
      <aside className="dashboard-today">
        <section className="fn-open-reminder" data-decoration="3"><span className="fn-reminder-tape" aria-hidden="true" /><div className="fn-open-heading"><h2>Remember {siena.reminders.length + familyReminders.length ? <span className="fn-count">{siena.reminders.length + familyReminders.length}</span> : null}</h2><RouteLink className="icon-control" href={to.fromSiena()} aria-label="All reminders" title="All reminders"><Icon name="forward" /></RouteLink></div>
          <div className="fn-reminder-items" role="region" aria-label="Due reminders">
            {reminderPreview.map(item => <SienaItemCard key={item.id} item={item} />)}
            {familyReminders.slice(0, 2).map(entry => <a key={entry.sourceId} className="event-row event-row-davis" href={DAVIS_SOURCE_URL} target="_blank" rel="noopener noreferrer"><span className="event-row-main"><strong>{entry.title}</strong><span className="event-source-tag">Davis · Read only{family.status !== 'ready' ? ' · Stale' : ''}</span><small>Due {readableDay(entry.startDate)}</small></span></a>)}
            {!siena.reminders.length && !familyReminders.length ? <p className="desk-empty">Nothing due today.</p> : null}
          </div>
          {familyReminders.length > 2 ? <a className="icon-control" href={DAVIS_SOURCE_URL} target="_blank" rel="noopener noreferrer" aria-label="All family reminders in Davis" title="All family reminders in Davis"><Icon name="source" /></a> : null}
        </section>
      {upcoming.length ? <section className="overview-upcoming"><div className="overview-section-head"><h2>Coming up</h2><RouteLink className="icon-control" href={to.calendar()} aria-label="Full calendar" title="Full calendar"><Icon name="calendar" /></RouteLink></div>{upcoming.slice(0, 3).map(entry => <div className="overview-agenda-day" key={entry.iso}><RouteLink className="overview-agenda-date" href={to.day(entry.iso)}>{readableDay(entry.iso)}</RouteLink><div className="overview-agenda-items">{entry.events.map(event => <EventRow key={event.id} event={event} />)}{entry.reminders.map(item => <RouteLink className="overview-agenda-reminder" key={item.id} href={to.fromSiena()}>{item.title ?? item.body}</RouteLink>)}</div></div>)}</section> : null}
        {['stale', 'offline', 'error', 'denied'].includes(family.status) ? <p className="calendar-source-status" role="status">{family.snapshot ? 'Family events may be out of date.' : 'Family events are unavailable.'} <RouteLink className="icon-control" href={to.settings()} aria-label="Calendar connection" title="Calendar connection"><Icon name="settings" /></RouteLink></p> : null}
      </aside>
    </div>
    <div className="dashboard-support"><div className="dashboard-projects"><ProjectDesk pages={pages} notebook={notebook} /></div>
    <div className="dashboard-agenda">
      {siena.updates.length ? <details className="desk-updates"><summary>Task updates · {siena.updates.length}</summary>{siena.updates.map(item => <SienaItemCard key={item.id} item={item} />)}</details> : null}
    </div></div>
  </div></main></div>
}
