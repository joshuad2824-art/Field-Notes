import { Icon } from './Icon'
import { useEffect, useRef, useState } from 'react'
import { notebookCounts } from '../lib/db'
import { countLabel } from '../lib/format'
import { colorName, coverColor } from '../lib/theme'
import { COVER_COLORS } from '../lib/model'
import { addNotebook, deleteNotebook, recolorNotebook, renameNotebook, useNotebooks } from '../lib/notebooks'
import { useLive } from '../lib/useLive'
import { useDismiss } from '../lib/dismiss'

interface Props {
  /* Opened from a spine: that notebook's row comes up ready to rename and
     recolour. */
  focus?: string
  onClose: () => void
  onAdded: (id: string) => void
  onDeleted: (id: string) => void
}

export function NotebookManager({ focus, onClose, onAdded, onDeleted }: Props) {
  const books = useNotebooks()
  useDismiss(true, onClose)
  const counts = useLive<Record<string, number>>(notebookCounts, [], {})
  const [confirm, setConfirm] = useState<string | null>(null)
  const [recoloring, setRecoloring] = useState<string | null>(focus ?? null)
  const [renaming, setRenaming] = useState(focus ?? '')
  const focusedRow = useRef<HTMLDivElement>(null)
  useEffect(() => focusedRow.current?.scrollIntoView({ block: 'nearest' }), [])
  const [name, setName] = useState('')
  const [color, setColor] = useState(COVER_COLORS[4])

  const doomed = books.find((book) => book.id === confirm) ?? null
  const doomedCount = doomed ? (counts[doomed.id] ?? 0) : 0
  const candidate = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  const alreadyNamed = candidate && books.some((book) =>
    book.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === candidate)

  const add = async () => {
    if (!candidate || alreadyNamed) return
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
            <Icon name="close" />
          </button>
        </div>

        <div className="manager-rows">
          {books.map((book) => (
            <div key={book.id} ref={book.id === focus ? focusedRow : undefined}>
              <div className="manager-row">
                {/* The dot is the control: a colour is data now, not a
                    christening. Swatches stay on COVER_COLORS — a free picker
                    would let a cover be any hex, and most arbitrary dark
                    colours vanish against the rail exactly as these nearly
                    do. */}
                <button
                  className="book-dot big"
                  style={{ background: coverColor(book.color) }}
                  onClick={() => setRecoloring(recoloring === book.id ? null : book.id)}
                  aria-label={`Recolour ${book.name}`}
                  title="Recolour"
                />
                {renaming === book.id ? (
                  <input
                    className="manager-name manager-rename"
                    defaultValue={book.name}
                    aria-label={`Rename ${book.name}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    onBlur={(e) => {
                      const next = e.currentTarget.value.replace(/\s+/g, ' ').trim()
                      if (next && next !== book.name) void renameNotebook(book.id, next)
                      setRenaming('')
                    }}
                  />
                ) : (
                  <span className="manager-name">{book.name}</span>
                )}
                <span className="manager-count">{countLabel(counts[book.id] ?? 0, 'page')}</span>
                <button
                  className="mark-button danger"
                  onClick={() => setConfirm(book.id)}
                  aria-label={`Delete ${book.name}`}
                  disabled={books.length === 1}
                  title={books.length === 1 ? 'The last notebook stays' : 'Delete'}
                >
                  <Icon name="trash" />
                </button>
              </div>
              {recoloring === book.id ? (
                <div className="manager-recolor swatch-row">
                  {COVER_COLORS.map((option) => (
                    <button
                      key={option}
                      className={`cover-swatch${option === book.color ? ' on' : ''}`}
                      style={{ background: option }}
                      onClick={async () => {
                        await recolorNotebook(book.id, option)
                        setRecoloring(null)
                      }}
                      aria-label={colorName(option)}
                    />
                  ))}
                </div>
              ) : null}
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
               aria-label="Delete it" title="Delete it"><Icon name="trash" /></button>
              <button className="outline" onClick={() => setConfirm(null)} aria-label="Keep it" title="Keep it"><Icon name="close" /></button>
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
            placeholder="What should I call it?" autoFocus={!focus}
            aria-label="Notebook name"
          />
          <div className="swatch-row">
            {COVER_COLORS.map((option) => (
              <button
                key={option}
                className={`cover-swatch${option === color ? ' on' : ''}`}
                style={{ background: option }}
                onClick={() => setColor(option)}
                aria-label={colorName(option)}
              />
            ))}
            <span className="grow" />
            <button className="plate-button tight" disabled={!candidate || !!alreadyNamed} onClick={add} aria-label="Add notebook" title="Add notebook">Add notebook</button>
          </div>
          <p className="manager-note" role={alreadyNamed ? 'status' : undefined}>
            {alreadyNamed
              ? 'A notebook with that name is already on the shelf.'
              : 'Covers come from the palette, so a new notebook still looks like it belongs on the shelf.'}
          </p>
        </div>
      </div>
    </div>
  )
}
