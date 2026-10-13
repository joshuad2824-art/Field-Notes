import { useEffect, useRef, useState } from 'react'
import { getPage, setStock } from '../lib/db'
import { useLive } from '../lib/useLive'
import { COVER_COLORS } from '../lib/model'
import { isReserved, notebookOf, recolorNotebook, useAllNotebooks } from '../lib/notebooks'
import { setSettings, useSettings } from '../lib/settings'
import { COLOR_NAMES, coverColor, colorName } from '../lib/theme'
export function ColorsGlyph() {
  return (
    <span className="colors-glyph" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} />
      ))}
    </span>
  )
}
export function ColorTray({
  notebook,
  pageId,
  onClose,
}: {
  notebook: string
  pageId?: string
  onClose: () => void
}) {
  const page = useLive(
    () => (pageId ? getPage(pageId) : Promise.resolve(undefined)),
    [pageId],
    undefined,
  )
  useAllNotebooks()
  const book = notebookOf(notebook)
  const settings = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    /* Escape is the frame's: it registered this tray on the dismiss stack. */
    return () => previous?.focus()
  }, [])
  return (
    <div className="color-tray-scrim" onClick={onClose}>
      <div
        className="color-tray-wrap"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Notebook colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="color-name">
          {book
            ? `${book.name} · ${colorName(book.color)}`
            : 'Open a notebook to choose its cover'}{' '}
          {error ? <span role="alert">{error}</span> : null}
        </div>
        <button className="colors-toggle" aria-label="Close colors" onClick={onClose}>
          <ColorsGlyph />
        </button>
        <div className="color-tray">
          <button
            className="stock-chip"
            onClick={() => {
              const stock = (page?.stock ?? settings.stock) === 'night' ? 'paper' : 'night'
              if (pageId)
                void setStock(pageId, stock).catch(() =>
                  setError('Could not save the page stock. Try again.'),
                )
              else setSettings({ stock })
            }}
          >
            {page?.stock ?? settings.stock} ▾
          </button>
          <div className="color-swatches">
            {COVER_COLORS.map((color, i) => (
              <button
                key={color}
                title={`${COLOR_NAMES[i]} ${color}`}
                aria-label={COLOR_NAMES[i]}
                aria-pressed={!!book && coverColor(book.color).toUpperCase() === color}
                disabled={!book || isReserved(book.id)}
                style={{ backgroundColor: color }}
                onClick={() => {
                  if (book)
                    void recolorNotebook(book.id, color).catch(() =>
                      setError('Could not save the cover. Try again.'),
                    )
                }}
              />
            ))}
          </div>
          {pageId ? (
            <button
              className="stock-chip"
              aria-label="Page style"
              onClick={() => {
                onClose()
                document.querySelector<HTMLButtonElement>('button[aria-label="Style"]')?.click()
              }}
            >
              Aa
            </button>
          ) : (
            <button className="stock-chip" aria-label="Close colors" onClick={onClose}>
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
