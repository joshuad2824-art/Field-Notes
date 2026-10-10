import { Icon } from './Icon'
import { useEffect, useRef, useState, type RefObject } from 'react'
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
import { linkAt, removeLink, writeLink, type NoteLink } from '../editor/links'
import { addImage, isImage } from '../lib/images'
import { imageMarkdown, type Pen, type Placement, type Stock } from '../lib/model'

interface Props {
  toggleRef: RefObject<HTMLButtonElement | null>
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

/* The swatch shows the hue the mark will actually land with. These are the
   night-stock tints solid — mid-value, clearly separable against the dark
   strip. The names are the file's and never change; only the values moved
   when the highlighters were re-solved for hue separation. */
const HIGHLIGHTS: { name: string; color: string }[] = [
  { name: 'oxblood', color: '#cc322c' },
  { name: 'forest', color: '#4e6d23' },
  { name: 'navy', color: '#465ba3' },
  { name: 'driftwood', color: '#ac3888' },
  { name: 'brass', color: '#a15200' },
]

/* Each group keeps its tools on one scrolling row. Group switches preserve
   the editor selection so formatting also works inside table cells. */
export function StyleTray({
  toggleRef,
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
  const [section, setSection] = useState<'Text' | 'Insert' | 'Appearance'>('Text')
  const trayRef = useRef<HTMLDivElement>(null)
  const linkBackdrop = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const [linkEdit, setLinkEdit] = useState<{
    range: { from: number; to: number }
    existing: NoteLink | null
    label: string
    url: string
  } | null>(null)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    const dismissOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (toggleRef.current?.contains(target)) return
      if (trayRef.current?.contains(target) && target !== linkBackdrop.current) return
      onClose()
    }
    /* A click follows both mouse and touch activation. Waiting until then
       lets the editor finish placing its caret/selection before the strip
       disappears and moves the writing upward. Nested controls stay inside
       this boundary, and Aa keeps its own open/close toggle. */
    document.addEventListener('click', dismissOutside, true)
    return () => document.removeEventListener('click', dismissOutside, true)
  }, [onClose, toggleRef])

  useEffect(() => {
    if (linkEdit) linkInput.current?.focus()
  }, [linkEdit !== null])

  const openLink = () => {
    if (!view) return
    const range = view.state.selection.main
    const existing = linkAt(view)
    setLinkError('')
    setLinkEdit({
      range: { from: range.from, to: range.to },
      existing,
      label: existing?.label ?? view.state.sliceDoc(range.from, range.to),
      url: existing?.url ?? '',
    })
  }

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
    <div ref={trayRef} className="tray" role="toolbar" aria-label="Style">
      <div className="tray-sections" aria-label="Formatting groups">
        {(['Text', 'Insert', 'Appearance'] as const).map(name => (
          <button key={name} aria-label={`${name} tools`} aria-pressed={section === name}
            onMouseDown={hold} onClick={() => setSection(name)}>{name}</button>
        ))}
        <span className="grow" />
        <button className="tray-close" onMouseDown={hold} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="tray-strip">
        {section === 'Text' && <>
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
          <button className="tray-word" onMouseDown={hold} onClick={openLink}
            aria-label="Link" title="Add or edit link"><Icon name="link" /></button>
        </div>

        <span className="tray-divider" />

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
            <Icon name="outdent" />
          </button>
          <button
            className="tray-block"
            onMouseDown={hold}
            onClick={run((v) => applyIndent(v, 1))}
            aria-label="More indent — ⇥"
            title="More indent — ⇥"
          >
            <Icon name="indent" />
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

        </>}
        {section === 'Appearance' && <>
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
            <Icon name="close" />
          </button>
        </div>

        </>}
        {section === 'Insert' && <>
        <div className="tray-group">
          <button className="tray-word" onMouseDown={hold} onClick={run(insertTable)} aria-label="Table" title="Table"><Icon name="table" /></button>
          <button
            className="tray-word"
            onMouseDown={hold}
            onClick={() => picker.current?.click()}
           aria-label="Picture" title="Picture"><Icon name="image" /></button>
        </div>

        </>}
        {section === 'Appearance' && <>
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

        </>}
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

      {linkEdit && <div ref={linkBackdrop} className="link-dialog-backdrop" onMouseDown={(e) => e.stopPropagation()}>
        <form className="link-dialog" aria-label={linkEdit.existing ? 'Edit link' : 'Add link'}
          onSubmit={(e) => {
            e.preventDefault()
            if (!view) return
            const error = writeLink(view, linkEdit.range, linkEdit.label, linkEdit.url, linkEdit.existing)
            if (error) setLinkError(error)
            else setLinkEdit(null)
          }}>
          <h2>{linkEdit.existing ? 'Edit link' : 'Add link'}</h2>
          <label>Text
            <input value={linkEdit.label} onChange={(e) => setLinkEdit({ ...linkEdit, label: e.target.value })}
              autoComplete="off" />
          </label>
          <label>URL
            <input ref={linkInput} type="url" inputMode="url" value={linkEdit.url}
              onChange={(e) => setLinkEdit({ ...linkEdit, url: e.target.value })}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="https://" />
          </label>
          {linkError && <p className="link-dialog-error" role="alert">{linkError}</p>}
          <div className="link-dialog-actions">
            {linkEdit.existing && <button type="button" onClick={() => {
              if (view) removeLink(view, linkEdit.existing!)
              setLinkEdit(null)
            }} aria-label="Remove link" title="Remove link"><Icon name="close" /></button>}
            <span className="grow" />
            <button type="button" onClick={() => {
              setLinkEdit(null)
              view?.focus()
            }} aria-label="Cancel" title="Cancel"><Icon name="close" /></button>
            <button type="submit" className="primary" aria-label="Save link" title="Save link"><Icon name="save" /></button>
          </div>
        </form>
      </div>}
    </div>
  )
}
