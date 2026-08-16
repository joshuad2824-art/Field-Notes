import { deletedPages, purgePage, restorePage } from '../lib/db'
import { TOMBSTONE_DAYS, type Page, snippetOf, titleOf } from '../lib/model'
import { back } from '../lib/router'
import { useLive } from '../lib/useLive'

function daysLeft(deleted: number): number {
  const gone = Math.floor((Date.now() - deleted) / 86400_000)
  return Math.max(0, TOMBSTONE_DAYS - gone)
}

export function TrashScreen() {
  const pages = useLive<Page[]>(deletedPages, [], [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <span className="chrome-title">Deleted</span>
      </header>

      <div className="scroll">
        {pages.length === 0 ? (
          <div className="empty">Nothing deleted.</div>
        ) : (
          <div className="rows">
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
          </div>
        )}
      </div>
    </div>
  )
}
