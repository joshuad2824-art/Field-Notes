import { useState } from 'react'
import { notebookCounts } from '../lib/db'
import { countLabel } from '../lib/format'
import { COVER_COLORS } from '../lib/model'
import { addNotebook, deleteNotebook, useNotebooks } from '../lib/notebooks'
import { useLive } from '../lib/useLive'

interface Props {
  onClose: () => void
  onAdded: (id: string) => void
  onDeleted: (id: string) => void
}

export function NotebookManager({ onClose, onAdded, onDeleted }: Props) {
  const books = useNotebooks()
  const counts = useLive<Record<string, number>>(notebookCounts, [], {})
  const [confirm, setConfirm] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COVER_COLORS[4])

  const doomed = books.find((book) => book.id === confirm) ?? null
  const doomedCount = doomed ? (counts[doomed.id] ?? 0) : 0

  const add = async () => {
    if (!name.trim()) return
    const book = await addNotebook(name, color)
    setName('')
    onAdded(book.id)
  }

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <div className="manager" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <div className="manager-head">
          <span className="manager-title">Notebooks</span>
          <span className="grow" />
          <button className="mark-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="manager-rows">
          {books.map((book) => (
            <div key={book.id} className="manager-row">
              <span className="book-dot big" style={{ background: book.color }} />
              <span className="manager-name">{book.name}</span>
              <span className="manager-count">{counts[book.id] ?? 0}</span>
              <button
                className="mark-button danger"
                onClick={() => setConfirm(book.id)}
                aria-label={`Delete ${book.name}`}
                disabled={books.length === 1}
                title={books.length === 1 ? 'The last notebook stays' : 'Delete'}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {doomed ? (
          <div className="manager-confirm">
            <div className="confirm-title">Delete {doomed.name}?</div>
            <div className="confirm-line">
              {doomedCount === 0
                ? 'It has no pages in it.'
                : `Its ${countLabel(doomedCount, 'page')} ${
                    doomedCount === 1 ? 'goes' : 'go'
                  } to the trash for thirty days.`}
            </div>
            <div className="confirm-buttons">
              <button
                className="outline danger"
                onClick={async () => {
                  await deleteNotebook(doomed.id)
                  setConfirm(null)
                  onDeleted(doomed.id)
                }}
              >
                Delete it
              </button>
              <button className="outline" onClick={() => setConfirm(null)}>
                Keep it
              </button>
            </div>
          </div>
        ) : null}

        <div className="manager-rule" />

        <div className="manager-add">
          <div className="section-label">Add one</div>
          <input
            className="well"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="What should I call it?"
            aria-label="Notebook name"
          />
          <div className="swatch-row">
            {COVER_COLORS.map((option) => (
              <button
                key={option}
                className={`cover-swatch${option === color ? ' on' : ''}`}
                style={{ background: option }}
                onClick={() => setColor(option)}
                aria-label={option}
              />
            ))}
            <span className="grow" />
            <button className="plate-button tight" disabled={!name.trim()} onClick={add}>
              Add notebook
            </button>
          </div>
          <p className="manager-note">
            Covers come from the palette, so a new notebook still looks like it belongs on the
            shelf.
          </p>
        </div>
      </div>
    </div>
  )
}
