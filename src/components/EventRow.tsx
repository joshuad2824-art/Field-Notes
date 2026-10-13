import { readableDay, clock } from '../lib/format'
import type { CalendarEvent } from '../davis/calendar'
import { DAVIS_SOURCE_URL } from '../davis/wire'
import { navigate, to } from '../lib/router'

export function EventRow({ event }: { event: CalendarEvent }) {
  if (event.externalSource === 'davis') return <a className="event-row event-row-davis" href={DAVIS_SOURCE_URL} target="_blank" rel="noopener noreferrer" aria-label={`${event.title} — Davis calendar, read only${event.stale ? ', awaiting refresh' : ''}`}>
    <span className="event-row-time">{event.endDate && event.endDate > event.date ? 'Multi-day' : (clock(event.startTime) ? `${clock(event.startTime)}${event.endTime ? ` → ${clock(event.endTime)}` : ''}` : 'All day')}</span>
    <span className="event-row-main"><span className="event-row-title">{event.title}</span><span className="event-source-tag">Davis · Read only{event.stale ? ' · Stale' : ''}</span>{event.endDate ? <span className="event-row-place">{readableDay(event.date)} – {readableDay(event.endDate)}</span> : null}{event.location ? <span className="event-row-place">{event.location}</span> : null}</span>
  </a>
  /* Apple Calendar is read only and lives in Apple's own app, so the row is
     plain text: nothing here opens an editor, and nothing becomes a note. */
  if (event.externalSource === 'apple') return <div className="event-row event-row-apple" role="group" aria-label={`${event.title} — Apple Calendar, read only${event.stale ? ', awaiting refresh' : ''}`}>
    <span className="event-row-time">{event.endDate && event.endDate > event.date ? 'Multi-day' : (clock(event.startTime) ? `${clock(event.startTime)}${event.endTime ? ` → ${clock(event.endTime)}` : ''}` : 'All day')}</span>
    <span className="event-row-main"><span className="event-row-title">{event.title}</span><span className="event-source-tag">Apple · Read only{event.stale ? ' · Stale' : ''}</span>{event.endDate ? <span className="event-row-place">{readableDay(event.date)} – {readableDay(event.endDate)}</span> : null}{event.location ? <span className="event-row-place">{event.location}</span> : null}</span>
  </div>
  return (
    <button className={`event-row${event.calendarTarget === 'Family' ? ' event-row-family' : ''}`} onClick={() => navigate(to.event(event.seriesId ?? event.id, event.occurrenceDate))}>
      <span className="event-row-time">{event.endDate && event.endDate > event.date ? 'Multi-day' : (clock(event.startTime) ? `${clock(event.startTime)}${event.endTime ? ` → ${clock(event.endTime)}` : ''}` : 'All day')}</span>
      <span className="event-row-main">
        <span className="event-row-title">{event.title}</span>
        {event.endDate ? <span className="event-row-place">{readableDay(event.date)} – {readableDay(event.endDate)}</span> : null}
        {event.calendarTarget === 'Family' ? <span className="event-row-place">Family calendar</span> : null}
        {event.location ? <span className="event-row-place">{event.location}</span> : null}
      </span>
    </button>
  )
}
