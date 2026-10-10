import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { deletedPages, purgePage, restorePage } from '../lib/db'
import { deletedEvents, purgeEvent, restoreEvent } from '../lib/events'
import { readableDay, clock } from '../lib/format'
import { TOMBSTONE_DAYS, type FieldEvent, type Page, snippetOf, titleOf } from '../lib/model'
import { back } from '../lib/router'
import { useLive } from '../lib/useLive'

function daysLeft(deleted: number): number {
  const gone = Math.floor((Date.now() - deleted) / 86400_000)
  return Math.max(0, TOMBSTONE_DAYS - gone)
}

export function TrashScreen() {
  const [purging, setPurging] = useState<{ kind: 'page' | 'event'; id: string; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function confirmPurge() {
    if (!purging || busy) return
    setBusy(true); setProblem('')
    try { if (purging.kind === 'page') await purgePage(purging.id); else await purgeEvent(purging.id); setPurging(null) }
    catch { setProblem('Could not delete this item. It is still in Deleted.') }
    finally { setBusy(false) }
  }
  const pages = useLive<Page[]>(deletedPages, [], [])
  const events = useLive<FieldEvent[]>(deletedEvents, [], [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          <Icon name="back" />
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
                  <button className="btn caps" onClick={() => void restorePage(page.id)} aria-label="Restore" title="Restore"><Icon name="restore" /></button>
                  <button className="btn caps danger" onClick={() => setPurging({ kind: 'page', id: page.id, title: titleOf(page.body) })} aria-label="Delete now" title="Delete now"><Icon name="trash" /></button>
                </div>
              </div>
            ))}
            {events.length ? <div className="section-label">Events</div> : null}
            {events.map((event) => (
              <div key={event.id} className="row-page" style={{ cursor: 'default' }}>
                <div className="row-title"><span>{event.title}</span></div>
                <div className="row-snippet">{readableDay(event.date)} · {clock(event.startTime) || 'All day'}</div>
                <div className="row-meta">
                  <span>{daysLeft(event.deleted ?? 0)} days left</span>
                  <button className="btn caps" onClick={() => void restoreEvent(event.id)} aria-label="Restore" title="Restore"><Icon name="restore" /></button>
                  <button className="btn caps danger" onClick={() => setPurging({ kind: 'event', id: event.id, title: event.title })} aria-label="Delete now" title="Delete now"><Icon name="trash" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {purging ? <Sheet onClose={() => { if (!busy) setPurging(null) }}><div className="purge-confirm" role="alertdialog" aria-labelledby="purge-heading"><h2 id="purge-heading">Permanently delete “{purging.title}”?</h2><p>This item cannot be restored.</p>{problem ? <p role="status">{problem}</p> : null}<div className="actions"><button className="btn danger" disabled={busy} onClick={() => void confirmPurge()}>Delete permanently</button><button className="btn" disabled={busy} onClick={() => setPurging(null)}>Cancel</button></div></div></Sheet> : null}
    </div>
  )
}
