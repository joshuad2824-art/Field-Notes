import { useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { applyBlock, applyHighlight, insertPicture } from '../editor/commands'
import { addImage, isImage } from '../lib/images'
import { PLACEMENTS, imageMarkdown, type Pen, type Placement, type Stock } from '../lib/model'

const PLACE_MARKS: Record<Placement, string> = { left: '◧', full: '▬', right: '◨' }
const PLACE_LABELS: Record<Placement, string> = {
  left: 'Writing on the right',
  full: 'Full measure',
  right: 'Writing on the left',
}

interface Props {
  view: EditorView | null
  pageId: string
  pen: Pen
  stock: Stock
  placement: Placement
  highlight: string
  onPlacement: (next: Placement) => void
  onHighlight: (color: string) => void
  onPen: () => void
  onStock: () => void
  onClose: () => void
}

const HIGHLIGHTS: { name: string; color: string }[] = [
  { name: 'oxblood', color: '#530a28' },
  { name: 'forest', color: '#123737' },
  { name: 'navy', color: '#082744' },
  { name: 'driftwood', color: '#3a342e' },
  { name: 'brass', color: '#7a6201' },
]

/* One tray instead of two rows of buttons. The toolbar at rest is three
   marks; everything that shapes the page lives behind Aa. */
export function StyleTray({
  view,
  pageId,
  pen,
  stock,
  placement,
  highlight,
  onPlacement,
  onHighlight,
  onPen,
  onStock,
  onClose,
}: Props) {
  const picker = useRef<HTMLInputElement>(null)

  const run = (fn: (v: EditorView) => void) => () => {
    if (view) fn(view)
  }

  const choose = async (file: File | undefined) => {
    if (!view || !isImage(file) || !file) return
    const record = await addImage(pageId, file)
    insertPicture(view, imageMarkdown(record.id, record.ext, '', placement))
  }

  return (
    <div className="tray" role="dialog" aria-label="Style">
      <div className="section-label tray-label">Style</div>
      <div className="tray-styles">
        <button className="tray-style serif lg" onClick={run((v) => applyBlock(v, '# '))}>
          Title
        </button>
        <button className="tray-style serif" onClick={run((v) => applyBlock(v, '## '))}>
          Heading
        </button>
        <button className="tray-style caps" onClick={run((v) => applyBlock(v, '### '))}>
          Sub
        </button>
      </div>

      <div className="tray-rule" />

      <div className="tray-swatches">
        {HIGHLIGHTS.map(({ name, color }) => (
          <button
            key={name}
            className={`sw${name === highlight ? ' on' : ''}`}
            style={{ background: color }}
            aria-label={name}
            onClick={() => {
              onHighlight(name)
              if (view) applyHighlight(view, name)
            }}
          />
        ))}
        <span className="grow" />
        <button
          className="tray-clear"
          onClick={run((v) => applyHighlight(v, 'off'))}
          aria-label="Remove highlight"
        >
          ×
        </button>
      </div>

      <div className="tray-rule" />

      <button className="tray-row" onClick={() => picker.current?.click()}>
        <span className="tray-row-name">Picture</span>
        <span className="tray-row-state">Add one</span>
      </button>
      <div className="tray-row tray-row-sub">
        <span className="tray-row-name">Sits</span>
        <span className="tray-places">
          {PLACEMENTS.map((option) => (
            <button
              key={option}
              className={`tray-place${option === placement ? ' on' : ''}`}
              onClick={() => onPlacement(option)}
              aria-label={PLACE_LABELS[option]}
              title={PLACE_LABELS[option]}
            >
              {PLACE_MARKS[option]}
            </button>
          ))}
        </span>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void choose(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <button className="tray-row" onClick={onPen}>
        <span className="tray-row-name">Pen</span>
        <span className={`tray-row-state${pen === 'felt' ? ' pen' : ''}`}>
          {pen === 'felt' ? 'fine pen' : 'ink'}
        </span>
      </button>

      <button className="tray-row" onClick={onStock}>
        <span className="tray-row-name">Stock</span>
        <span className="tray-row-state mono">{stock}</span>
      </button>

      <button className="tray-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}
