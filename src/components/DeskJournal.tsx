import { SienaItemCard } from './SienaItemCard'
import { EventRow } from './EventRow'
import { Icon } from './Icon'
import { RouteLink } from './DeskHeader'
import { to } from '../lib/router'
import type { SienaItem } from '../lib/model'
import type { CalendarEvent } from '../davis/calendar'

export function DeskJournal({ note, events, today, unseen }: { note?: SienaItem; events: CalendarEvent[]; today: string; unseen: number }) {
  return <section className="fn-notebook overview-from-siena" aria-label="Desk journal">
    <span className="fn-book-cover-gutter" aria-hidden="true" /><div className="fn-book-spread">
      <div className="fn-page fn-page-left"><div className="fn-note-top"><RouteLink className="fn-tape-label" href={to.fromSiena()} aria-label={`All saved items${unseen ? `, ${unseen} unseen` : ''}`}>From Siena{unseen ? <span className="siena-badge">{unseen}</span> : null}</RouteLink></div>
        {note ? <SienaItemCard item={note} paper journal /> : <p className="fn-note-body">No new note here. Your saved items are still available.</p>}
      </div>
      <section className="fn-page fn-page-right notebook-events overview-events" aria-labelledby="notebook-events-heading">
        <span className="fn-book-ribbon" aria-hidden="true" />
        <div className="overview-section-head"><h2 id="notebook-events-heading">Events for the day</h2><div className="desk-project-actions">
          <RouteLink className="icon-control" href={to.day(today)} aria-label="Open today" title="Open today"><Icon name="calendar" /></RouteLink>
          <RouteLink className="icon-control" href={to.newEvent(today)} aria-label="Add event" title="Add event"><Icon name="add" /></RouteLink>
        </div></div>
        <div className="notebook-event-list">
          {events.length ? events.slice(0, 3).map(event => <EventRow key={event.id} event={event} />) : <p className="overview-empty">Nothing planned today.</p>}
        </div>
        {events.length > 3 ? <RouteLink className="notebook-event-more icon-control" href={to.day(today)} aria-label={`All ${events.length} events today`} title={`All ${events.length} events today`}><Icon name="forward" /></RouteLink> : null}
      </section><span className="fn-book-gutter" aria-hidden="true" />
    </div>
  </section>
}
