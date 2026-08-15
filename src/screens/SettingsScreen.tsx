import { useEffect, useState } from 'react'
import { requestPersistence, storageEstimate } from '../lib/db'
import { exportNotebook, exportShelf } from '../lib/export'
import { bytes } from '../lib/format'
import { NOTEBOOKS, type NotebookId } from '../lib/model'
import { back, navigate, to } from '../lib/router'

export function SettingsScreen() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string>('—')

  useEffect(() => {
    void navigator.storage?.persisted?.().then((v) => setPersisted(v))
    void storageEstimate().then((e) => {
      if (e) setUsage(bytes(e.usage))
    })
  }, [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <span className="chrome-title">Settings</span>
      </header>

      <div className="scroll">
        <div className="panel-card">
          <h2>Export</h2>
          <p>
            Storage is markdown, so an export is a copy rather than a conversion. Each page
            carries a short frontmatter block for the dates and attributes a filename can't
            hold.
          </p>
          <div className="actions">
            <button className="btn caps" onClick={() => void exportShelf()}>
              Whole shelf
            </button>
            {NOTEBOOKS.map((book) => (
              <button
                key={book.id}
                className="btn caps"
                onClick={() => void exportNotebook(book.id as NotebookId)}
              >
                {book.name}
              </button>
            ))}
          </div>

          <h2>Storage</h2>
          <p>
            Pages live on this device in IndexedDB. Nothing here talks to a network. Deleted
            pages linger for thirty days before they go.
          </p>
          <div className="actions">
            <button className="btn caps" onClick={() => navigate(to.trash())}>
              Deleted pages
            </button>
            <button
              className="btn caps"
              onClick={async () => setPersisted(await requestPersistence())}
            >
              Keep on device
            </button>
          </div>
          <p className="meta" style={{ marginTop: 16 }}>
            {persisted === null ? 'checking' : persisted ? 'persistent' : 'best effort'} · {usage}{' '}
            used
          </p>

          <h2>Phase</h2>
          <p>
            Phase 1 — the single-device notebook. Sync is Phase 2 and deliberately not started;
            the month of daily use comes first.
          </p>
        </div>
      </div>
    </div>
  )
}
