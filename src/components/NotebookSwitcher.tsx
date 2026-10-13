import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useFrame } from './ApprovedFrame'
import { isReserved, journalBook, notebookForPage, useNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { navigate, to } from '../lib/router'
import { setSettings } from '../lib/settings'
import { useDismiss } from '../lib/dismiss'

/* The shelf itself: every notebook as a coloured dot and its name, Journal
   below a rule, and a quiet + to add one. It is drawn in two places — under a
   notebook's name, and above the pill when Notebooks is tapped from inside a
   notebook — so it lives here once. Journal is somewhere you go rather than a
   notebook you file into, and visiting it never makes it the notebook the app
   opens into. */
export function ShelfMenu({
  current,
  onDone,
  className = '',
  style,
}: {
  current?: string
  onDone: () => void
  className?: string
  style?: React.CSSProperties
}) {
  const books = useNotebooks()
  const frame = useFrame()
  const journal = journalBook()
  const pick = (id: string) => {
    if (!isReserved(id)) setSettings({ notebook: id })
    onDone()
    navigate(to.notebookHome(id))
  }
  return (
    <div className={`notebook-switcher-menu ${className}`} role="menu" aria-label="Notebooks" style={style}>
      {books.map((b) => (
        <button key={b.id} role="menuitemradio" aria-checked={b.id === current} onClick={() => pick(b.id)}>
          <i style={{ background: coverColor(b.color) }} />
          {b.name}
        </button>
      ))}
      <hr />
      <button role="menuitemradio" aria-checked={journal.id === current} onClick={() => pick(journal.id)}>
        <i style={{ background: coverColor(journal.color) }} />
        {journal.name}
      </button>
      <button
        className="notebook-switcher-add"
        role="menuitem"
        aria-label="Add a notebook"
        title="Add a notebook"
        onClick={() => {
          onDone()
          frame?.manage()
        }}
      >
        <Icon name="add" />
      </button>
    </div>
  )
}

/* The notebook's own name is how you change notebooks. One tap drops the
   shelf; a second picks. A small, quiet chevron beside the name is the only
   hint that the name opens anything — a word would explain, a mark only
   points. */
export function NotebookSwitcher({
  notebook,
  className = '',
  children,
}: {
  notebook: string
  className?: string
  children?: ReactNode
}) {
  const book = notebookForPage(notebook)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  /* Esc closes the shelf and nothing else, through the one dismiss stack. */
  useDismiss(open, () => setOpen(false))
  return (
    <div className={`notebook-switcher${open ? ' open' : ''} ${className}`} ref={wrap}>
      <button
        className="notebook-switcher-name"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${book.name} — switch notebook`}
        title="Switch notebook"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="notebook-switcher-label">{children ?? book.name}</span>
        <svg className="notebook-switcher-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      {open ? <ShelfMenu current={book.id} onDone={() => setOpen(false)} /> : null}
    </div>
  )
}
