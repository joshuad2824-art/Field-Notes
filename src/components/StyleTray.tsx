import { useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import {
  type Align,
  applyAlign,
  applyBlock,
  applyCaps,
  applyHighlight,
  applyIndent,
  applyWrap,
  insertPicture,
} from '../editor/commands'
import { capsInCell, insertTable, markInCell } from '../editor/table'
import { addImage, isImage } from '../lib/images'
import { imageMarkdown, type Pen, type Placement, type Stock } from '../lib/model'

interface Props {
  view: EditorView | null
  pageId: string
  pen: Pen
  stock: Stock
  placement: Placement
  highlight: string
  zoom: number
  onHighlight: (color: string) => void
  onPen: () => void
  onStock: () => void
  onZoom: (direction: 1 | -1) => void
  onClose: () => void
}

/* The blocks a line can be turned into, and the marks a word can be given.
   The glyphs are the ones the page itself draws — a round box, because that is
   what the checkbox is — so the button looks like its result. */
const BLOCKS: { mark: string; prefix: string; label: string; cls?: string }[] = [
  { mark: '•', prefix: '* ', label: 'Bullet' },
  { mark: '–', prefix: '- ', label: 'Dash' },
  { mark: '1.', prefix: '1. ', label: 'Numbers', cls: 'mono' },
  { mark: '○', prefix: '- [ ] ', label: 'Checkbox', cls: 'ring' },
  { mark: '“', prefix: '> ', label: 'Quote', cls: 'serif' },
]

/* `close` is only ever given when it differs from `open`, which so far is the
   underline and its closing tag. */
const MARKS: {
  mark: string
  open: string
  close?: string
  label: string
  cls: string
  cell: string
}[] = [
  { mark: 'B', open: '**', label: 'Bold — ⌘B', cls: 'bold', cell: 'bold' },
  { mark: 'I', open: '*', label: 'Italic — ⌘I', cls: 'italic', cell: 'italic' },
  {
    mark: 'U',
    open: '<u>',
    close: '</u>',
    label: 'Underline — ⌘U',
    cls: 'under',
    cell: 'underline',
  },
  { mark: 'S', open: '~~', label: 'Strike', cls: 'strike', cell: 'strike' },
  { mark: 'code', open: '`', label: 'Code', cls: 'mono', cell: 'code' },
]

/* The two alignments that aren't the default, drawn rather than typed. There
   is no character that means "centred", and the three that come closest are a
   menu, a maths symbol and a piece of box drawing — so these are three bars
   set where the mark would set the writing, which is the one picture that says
   it without a word. */
function AlignMark({ align }: { align: Exclude<Align, 'left'> }) {
  const short = align === 'center' ? 4.5 : 7
  return (
    <svg viewBox="0 0 16 12" aria-hidden="true" className="align-mark">
      <rect x="2" y="1.3" width="12" height="1.5" rx="0.75" />
      <rect x={short} y="5.25" width="7" height="1.5" rx="0.75" />
      <rect x="2" y="9.2" width="12" height="1.5" rx="0.75" />
    </svg>
  )
}

const HIGHLIGHTS: { name: string; color: string }[] = [
  { name: 'oxblood', color: '#530a28' },
  { name: 'forest', color: '#123737' },
  { name: 'navy', color: '#082744' },
  { name: 'driftwood', color: '#3a342e' },
  { name: 'brass', color: '#7a6201' },
]

/* One strip, not a box.

   It opens along the top of the leaf rather than dropping a tall rectangle
   over the writing, so the page being shaped stays in view while it is
   shaped. Past the width it has, the strip scrolls sideways rather than
   wrapping into the second row it was trying not to be. */
export function StyleTray({
  view,
  pageId,
  pen,
  stock,
  placement,
  highlight,
  zoom,
  onHighlight,
  onPen,
  onStock,
  onZoom,
  onClose,
}: Props) {
  const picker = useRef<HTMLInputElement>(null)

  const run = (fn: (v: EditorView) => void) => () => {
    if (view) fn(view)
  }

  /* Pressing anything in the strip must not take the focus off what it is
     about to shape — CodeMirror keeps its selection in state and survives a
     blur, but a contenteditable table cell does not. */
  const hold = (e: { preventDefault: () => void }) => e.preventDefault()

  const choose = async (file: File | undefined) => {
    if (!view || !isImage(file) || !file) return
    const record = await addImage(pageId, file)
    insertPicture(view, imageMarkdown(record.id, record.ext, '', placement))
  }

  return (
    <div className="tray" role="toolbar" aria-label="Style">
      <div className="tray-strip">
        <div className="tray-group">
          <button
            className="tray-style serif lg"
            onMouseDown={hold}
            onClick={run((v) => applyBlock(v, '# '))}
          >
            Title
          </button>
          <button
            className="tray-style serif"
            onMouseDown={hold}
            onClick={run((v) => applyBlock(v, '## '))}
          >
            Heading
          </button>
          <button
            className="tray-style caps"
            onMouseDown={hold}
            onClick={run((v) => applyBlock(v, '### '))}
          >
            Sub
          </button>
        </div>

        <span className="tray-divider" />

        <div className="tray-group">
          {BLOCKS.map(({ mark, prefix, label, cls }) => (
            <button
              key={label}
              className={`tray-block${cls ? ' ' + cls : ''}`}
              onMouseDown={hold}
              onClick={run((v) => applyBlock(v, prefix))}
              aria-label={label}
              title={label}
            >
              {mark}
            </button>
          ))}
          <button
            className="tray-block"
            onMouseDown={hold}
            onClick={run((v) => applyIndent(v, -1))}
            aria-label="Less indent — ⇧⇥"
            title="Less indent — ⇧⇥"
          >
            ⇤
          </button>
          <button
            className="tray-block"
            onMouseDown={hold}
            onClick={run((v) => applyIndent(v, 1))}
            aria-label="More indent — ⇥"
            title="More indent — ⇥"
          >
            ⇥
          </button>
          {/* Tapping either a second time puts the line back to the margin,
              which is the only way back once the caret has moved on. */}
          <button
            className="tray-block draw"
            onMouseDown={hold}
            onClick={run((v) => applyAlign(v, 'center'))}
            aria-label="Centre the line"
            title="Centre the line"
          >
            <AlignMark align="center" />
          </button>
          <button
            className="tray-block draw"
            onMouseDown={hold}
            onClick={run((v) => applyAlign(v, 'right'))}
            aria-label="Line to the right"
            title="Line to the right"
          >
            <AlignMark align="right" />
          </button>
        </div>

        <span className="tray-divider" />

        <div className="tray-group">
          {MARKS.map(({ mark, open, close, label, cls, cell }) => (
            <button
              key={label}
              className={`tray-mark ${cls}`}
              onMouseDown={hold}
              /* Inside a table the browser is the editor, so a mark goes to
                 the cell rather than to CodeMirror. */
              onClick={run((v) => markInCell(cell) || applyWrap(v, open, close ?? open))}
              aria-label={label}
              title={label}
            >
              {mark}
            </button>
          ))}
          <button
            className="tray-mark shout"
            onMouseDown={hold}
            onClick={run((v) => capsInCell() || applyCaps(v))}
            aria-label="All caps"
            title="All caps"
          >
            AA
          </button>
        </div>

        <span className="tray-divider" />

        <div className="tray-group">
          {HIGHLIGHTS.map(({ name, color }) => (
            <button
              key={name}
              className={`sw${name === highlight ? ' on' : ''}`}
              style={{ background: color }}
              aria-label={name}
              onMouseDown={hold}
              onClick={() => {
                onHighlight(name)
                if (markInCell(name)) return
                if (view) applyHighlight(view, name)
              }}
            />
          ))}
          <button
            className="tray-clear"
            onMouseDown={hold}
            /* Inside a table the browser is the editor, so taking a colour off
               is the cell's own business — the same as putting one on. */
            onClick={run((v) => markInCell('off') || applyHighlight(v, 'off'))}
            aria-label="Remove highlight"
            title="Remove highlight"
          >
            ×
          </button>
        </div>

        <span className="tray-divider" />

        <div className="tray-group">
          <button className="tray-word" onMouseDown={hold} onClick={run(insertTable)}>
            Table
          </button>
          <button
            className="tray-word"
            onMouseDown={hold}
            onClick={() => picker.current?.click()}
          >
            Picture
          </button>
        </div>

        <span className="tray-divider" />

        <div className="tray-group">
          <button
            className={`tray-word${pen === 'felt' ? ' pen' : ''}`}
            onMouseDown={hold}
            onClick={onPen}
            title="Pen"
          >
            {pen === 'felt' ? 'fine pen' : 'ink'}
          </button>
          <button className="tray-word mono" onMouseDown={hold} onClick={onStock} title="Stock">
            {stock}
          </button>
        </div>

        <span className="tray-divider" />

        {/* For standing a page on a big screen in front of a room. */}
        <div className="tray-group">
          <button
            className="tray-step"
            onMouseDown={hold}
            onClick={() => onZoom(-1)}
            aria-label="Smaller"
            title="Smaller"
          >
            −
          </button>
          <span className="tray-zoom">{Math.round(zoom * 100)}%</span>
          <button
            className="tray-step"
            onMouseDown={hold}
            onClick={() => onZoom(1)}
            aria-label="Larger"
            title="Larger"
          >
            +
          </button>
        </div>

        <span className="grow" />

        <button className="tray-close" onMouseDown={hold} onClick={onClose} aria-label="Close">
          ×
        </button>
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
    </div>
  )
}
