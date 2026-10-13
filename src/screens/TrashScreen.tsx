import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { deletedPages, purgePage, restorePage } from '../lib/db'
import { deletedEvents, purgeEvent, restoreEvent } from '../lib/events'
import { readableDay, clock } from '../lib/format'
import { TOMBSTONE_DAYS, type FieldEvent, type Page, snippetOf, titleOf } from '../lib/model'
import { useLive } from '../lib/useLive'

function daysLeft(deleted: number): number {
  const gone = Math.floor((Date.now() - deleted) / 86400_000)
  return Math.max(0, TOMBSTONE_DAYS - gone)
}

export function TrashScreen() {
  const [purging, setPurging] = useState<{
    kind: 'page' | 'event' | 'all'
    id: string
    title: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function confirmPurge() {
    if (!purging || busy) return
    setBusy(true)
    setProblem('')
    try {
      if (purging.kind === 'all') {
        for (const page of pages) await purgePage(page.id)
        for (const event of events) await purgeEvent(event.id)
      } else if (purging.kind === 'page') await purgePage(purging.id)
      else await purgeEvent(purging.id)
      setPurging(null)
    } catch {
      setProblem('Could not delete this item. It is still in Deleted.')
    } finally {
      setBusy(false)
    }
  }
  const pages = useLive<Page[]>(deletedPages, [], [])
  const events = useLive<FieldEvent[]>(deletedEvents, [], [])

  return (
    <div className="app trash-app">
      <header className="chrome">
        <h1 className="chrome-title">Trash</h1>
        {pages.length + events.length > 0 ? (
          <button
            className="trash-empty-button"
            onClick={() => setPurging({ kind: 'all', id: 'all', title: 'all items' })}
          >
            Empty trash
          </button>
        ) : null}
      </header>

      <div className="scroll">
        {pages.length === 0 && events.length === 0 ? (
          <div className="empty-state">
            <h2>The trash is empty.</h2>
            <p>Anything you delete waits here for thirty days before it’s gone for good.</p>
            <img src="/redesign/pair-puffin-lead.webp" alt="" />
          </div>
        ) : (
          <div className="rows">
            <p className="trash-count">
              {pages.length + events.length} items · Each kept thirty days
            </p>
            {pages.length ? <div className="section-label">Pages</div> : null}
            {pages.map((page) => (
              <div key={page.id} className="row-page" style={{ cursor: 'default' }}>
                <div className="row-title">
                  <span>{titleOf(page.body)}</span>
                </div>
                <div className="row-snippet">{snippetOf(page.body)}</div>
                <div className="row-meta">
                  <span>
                    {daysLeft(page.deleted ?? 0)} days left
                    <progress max={30} value={daysLeft(page.deleted ?? 0)} />
                  </span>
                  <button
                    className="btn caps"
                    onClick={() => void restorePage(page.id)}
                    aria-label="Restore"
                    title="Restore"
                  >
                    <Icon name="restore" /> Restore
                  </button>
                  <button
                    className="btn caps danger"
                    onClick={() =>
                      setPurging({ kind: 'page', id: page.id, title: titleOf(page.body) })
                    }
                    aria-label="Delete now"
                    title="Delete now"
                  >
                    Delete now
                  </button>
                </div>
              </div>
            ))}
            {events.length ? <div className="section-label">Events</div> : null}
            {events.map((event) => (
              <div key={event.id} className="row-page" style={{ cursor: 'default' }}>
                <div className="row-title">
                  <span>{event.title}</span>
                </div>
                <div className="row-snippet">
                  {readableDay(event.date)} · {clock(event.startTime) || 'All day'}
                </div>
                <div className="row-meta">
                  <span>
                    {daysLeft(event.deleted ?? 0)} days left
                    <progress max={30} value={daysLeft(event.deleted ?? 0)} />
                  </span>
                  <button
                    className="btn caps"
                    onClick={() => void restoreEvent(event.id)}
                    aria-label="Restore"
                    title="Restore"
                  >
                    <Icon name="restore" /> Restore
                  </button>
                  <button
                    className="btn caps danger"
                    onClick={() =>
                      setPurging({ kind: 'event', id: event.id, title: event.title })
                    }
                    aria-label="Delete now"
                    title="Delete now"
                  >
                    Delete now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {purging ? (
        <Sheet
          onClose={() => {
            if (!busy) setPurging(null)
          }}
        >
          <div className="purge-confirm" role="alertdialog" aria-labelledby="purge-heading">
            <h2 id="purge-heading">
              {purging.kind === 'all'
                ? 'Empty the trash permanently?'
                : `Permanently delete “${purging.title}”?`}
            </h2>
            <p>These deletions cannot be undone.</p>
            {problem ? <p role="status">{problem}</p> : null}
            <div className="actions">
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => void confirmPurge()}
              >
                Delete permanently
              </button>
              <button className="btn" disabled={busy} onClick={() => setPurging(null)}>
                Cancel
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
