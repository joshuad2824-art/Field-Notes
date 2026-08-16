import { useEffect, useState } from 'react'
import { requestPersistence, storageEstimate } from '../lib/db'
import { exportNotebook, exportShelf } from '../lib/export'
import { bytes } from '../lib/format'
import type { NotebookId } from '../lib/model'
import { useNotebooks } from '../lib/notebooks'
import { setSettings, useSettings } from '../lib/settings'
import { back, navigate, to } from '../lib/router'

export function SettingsScreen() {
  const settings = useSettings()
  const books = useNotebooks()
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
          <h2>Pages</h2>
          <p>
            What a new page opens as, and what every page that hasn't been given its own answer
            follows. Change it here and they all change with it.
          </p>
          <div className="actions">
            <button
              className={`btn caps${settings.stock === 'night' ? ' on' : ''}`}
              onClick={() =>
                setSettings({ stock: settings.stock === 'night' ? 'paper' : 'night' })
              }
            >
              Stock · {settings.stock}
            </button>
            <button
              className={`btn caps${settings.pen === 'felt' ? ' on' : ''}`}
              onClick={() => setSettings({ pen: settings.pen === 'felt' ? 'ink' : 'felt' })}
            >
              Pen · {settings.pen}
            </button>
          </div>
          <div className="specimen" data-stock={settings.stock} data-pen={settings.pen}>
            <div className="specimen-leaf">
              <span className="specimen-text">The first morning</span>
            </div>
          </div>

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
            {books.map((book) => (
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
            {persisted === null ? 'checking' : persisted ? 'persistent' : 'best effort'} ·{' '}
            {usage} used
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
