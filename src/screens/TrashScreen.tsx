import { deletedPages, purgePage, restorePage } from '../lib/db'
import { deletedEvents, purgeEvent, restoreEvent } from '../lib/events'
import { readableDay } from '../lib/format'
import { TOMBSTONE_DAYS, type FieldEvent, type Page, snippetOf, titleOf } from '../lib/model'
import { back } from '../lib/router'
import { useLive } from '../lib/useLive'

function daysLeft(deleted: number): number {
  const gone = Math.floor((Date.now() - deleted) / 86400_000)
  return Math.max(0, TOMBSTONE_DAYS - gone)
}

export function TrashScreen() {
  const pages = useLive<Page[]>(deletedPages, [], [])
  const events = useLive<FieldEvent[]>(deletedEvents, [], [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <span className="chrome-title">Deleted</span>
      </header>

      <div className="scroll">
        {pages.length === 0 && events.length === 0 ? (
          <div className="empty">Nothing deleted.</div>
        ) : (
          <div className="rows">
            {pages.length ? <div className="section-label">Pages</div> : null}
            {pages.map((page) => (
              <div key={page.id} className="row-page" style={{ cursor: 'default' }}>
                <div className="row-title">
                  <span>{titleOf(page.body)}</span>
                </div>
                <div className="row-snippet">{snippetOf(page.body)}</div>
                <div className="row-meta">
                  <span>{daysLeft(page.deleted ?? 0)} days left</span>
                  <button className="btn caps" onClick={() => void restorePage(page.id)}>
                    Restore
                  </button>
                  <button className="btn caps danger" onClick={() => void purgePage(page.id)}>
                    Delete now
                  </button>
                </div>
              </div>
            ))}
            {events.length ? <div className="section-label">Events</div> : null}
            {events.map((event) => (
              <div key={event.id} className="row-page" style={{ cursor: 'default' }}>
                <div className="row-title"><span>{event.title}</span></div>
                <div className="row-snippet">{readableDay(event.date)} · {event.startTime ?? 'All day'}</div>
                <div className="row-meta">
                  <span>{daysLeft(event.deleted ?? 0)} days left</span>
                  <button className="btn caps" onClick={() => void restoreEvent(event.id)}>Restore</button>
                  <button className="btn caps danger" onClick={() => void purgeEvent(event.id)}>Delete now</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
