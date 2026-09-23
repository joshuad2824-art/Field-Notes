import { pagesOnDay } from '../lib/db'
import { readableDay } from '../lib/format'
import { isoMonth } from '../lib/calendar'
import type { Page } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'
import { EventRow } from '../components/EventRow'
import { eventsOnDay } from '../lib/events'
import type { FieldEvent } from '../lib/model'

/* One day's pages. A lens, never a container — nothing is filed here, it is
   only being looked at by the day it was written on. */
export function DayScreen({ iso, notebook }: { iso: string; notebook: string }) {
  const pages = useLive<Page[]>(() => pagesOnDay(iso), [iso], [])
  const events = useLive<FieldEvent[]>(() => eventsOnDay(iso), [iso], [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="link-caps" onClick={() => back(to.calendar(isoMonth(iso)))}>‹ Back</button>
        <span className="chrome-title">{readableDay(iso)}</span>
        <span className="grow" />
        <button className="link-caps" onClick={() => navigate(to.notebook(notebook))}>Notebook</button>
        <button className="link-caps" onClick={() => navigate(to.newEvent(iso))}>Add event</button>
        <button className="link-caps" onClick={() => navigate(to.calendar(isoMonth(iso)))}>
          Month
        </button>
      </header>

      <div className="scroll">
        {events.length ? <div className="day-events"><div className="section-label">Events</div>{events.map((event) => <EventRow key={event.id} event={event} />)}</div> : null}
        {pages.length ? (
          <div className="rows">
            {pages.map((page) => (
              <PageRow key={page.id} page={page} showNotebook />
            ))}
          </div>
        ) : null}
        {!events.length && !pages.length ? <div className="empty">Nothing is on this day yet.</div> : null}
      </div>
    </div>
  )
}
