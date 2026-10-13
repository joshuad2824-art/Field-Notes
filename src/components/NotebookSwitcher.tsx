import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useFrame } from './ApprovedFrame'
import { isReserved, journalBook, notebookForPage, useNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { navigate, to } from '../lib/router'
import { setSettings } from '../lib/settings'

/* The notebook's own name is how you change notebooks. One tap drops the
   shelf; a second picks. Journal sits below a rule because it is somewhere
   you go rather than a notebook you file into, and — as in pickNotebook —
   visiting it never makes it the notebook the app opens into. */
export function NotebookSwitcher({
  notebook,
  className = '',
  children,
}: {
  notebook: string
  className?: string
  children?: ReactNode
}) {
  const books = useNotebooks()
  const frame = useFrame()
  const journal = journalBook()
  const book = notebookForPage(notebook)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  const pick = (id: string) => {
    if (!isReserved(id)) setSettings({ notebook: id })
    setOpen(false)
    navigate(to.notebookHome(id))
  }
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
        {children ?? book.name}
      </button>
      {open ? (
        <div className="notebook-switcher-menu" role="menu" aria-label="Notebooks">
          {books.map((b) => (
            <button
              key={b.id}
              role="menuitemradio"
              aria-checked={b.id === book.id}
              onClick={() => pick(b.id)}
            >
              <i style={{ background: coverColor(b.color) }} />
              {b.name}
            </button>
          ))}
          <hr />
          <button
            role="menuitemradio"
            aria-checked={journal.id === book.id}
            onClick={() => pick(journal.id)}
          >
            <i style={{ background: coverColor(journal.color) }} />
            {journal.name}
          </button>
          <button
            className="notebook-switcher-add"
            role="menuitem"
            aria-label="Add a notebook"
            title="Add a notebook"
            onClick={() => {
              setOpen(false)
              frame?.manage()
            }}
          >
            <Icon name="add" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
