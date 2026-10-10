import { readableDay } from '../lib/format'
import type { CalendarEvent } from '../davis/calendar'
import { DAVIS_SOURCE_URL } from '../davis/wire'
import { navigate, to } from '../lib/router'

export function EventRow({ event }: { event: CalendarEvent }) {
  if (event.externalSource === 'davis') return <a className="event-row event-row-davis" href={DAVIS_SOURCE_URL} target="_blank" rel="noopener noreferrer" aria-label={`${event.title} — Davis calendar, read only${event.stale ? ', awaiting refresh' : ''}`}>
    <span className="event-row-time">{event.endDate && event.endDate > event.date ? 'Multi-day' : event.startTime || 'All day'}</span>
    <span className="event-row-main"><span className="event-row-title">{event.title}</span><span className="event-source-tag">Davis · Read only{event.stale ? ' · Stale' : ''}</span>{event.endDate ? <span className="event-row-place">{readableDay(event.date)} – {readableDay(event.endDate)}</span> : null}{event.location ? <span className="event-row-place">{event.location}</span> : null}</span>
  </a>
  return (
    <button className="event-row" onClick={() => navigate(to.event(event.seriesId ?? event.id, event.occurrenceDate))}>
      <span className="event-row-time">{event.endDate && event.endDate > event.date ? 'Multi-day' : event.startTime ?? 'All day'}</span>
      <span className="event-row-main">
        <span className="event-row-title">{event.title}</span>
        {event.endDate ? <span className="event-row-place">{readableDay(event.date)} – {readableDay(event.endDate)}</span> : null}
        {event.calendarTarget === 'Family' ? <span className="event-row-place">Family calendar</span> : null}
        {event.location ? <span className="event-row-place">{event.location}</span> : null}
      </span>
    </button>
  )
}
