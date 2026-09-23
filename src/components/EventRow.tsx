import type { FieldEvent } from '../lib/model'
import { navigate, to } from '../lib/router'

export function EventRow({ event }: { event: FieldEvent }) {
  return (
    <button className="event-row" onClick={() => navigate(to.event(event.id))}>
      <span className="event-row-time">{event.startTime ?? 'All day'}</span>
      <span className="event-row-main">
        <span className="event-row-title">{event.title}</span>
        {event.calendarTarget === 'Family' ? <span className="event-row-place">Family calendar</span> : null}
        {event.location ? <span className="event-row-place">{event.location}</span> : null}
      </span>
    </button>
  )
}
