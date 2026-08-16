import { daysWritten, notebookCounts } from '../lib/db'
import { mastheadParts } from '../lib/format'
import { monthNow } from '../lib/calendar'
import { useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { MonthGrid } from './MonthGrid'

interface Props {
  activeId: string
  onPick: (id: string) => void
  onManage: () => void
  onFold: () => void
}

/* The date is the masthead. There is no chrome bar above it — the rail is the
   top-left of the app. */
export function Rail({ activeId, onPick, onManage, onFold }: Props) {
  const books = useNotebooks()
  const counts = useLive<Record<string, number>>(notebookCounts, [], {})
  const written = useLive<Set<string>>(daysWritten, [], new Set())
  const { weekday, day, month, year } = mastheadParts()

  return (
    <aside className="rail">
      <div className="rail-wordmark">
        <img src="/logo-wordmark-reverse.png" alt="Timber &amp; Ink" />
        <span className="grow" />
        {/* The rail folds itself, so it can be put away with the list
            already gone. */}
        <button
          className="mark-button tight"
          onClick={onFold}
          aria-label="Hide the notebooks"
          title="Notebooks — ⌘⇧\"
        >
          ‹
        </button>
      </div>

      <div className="rail-date">
        <div className="rail-weekday">{weekday}</div>
        {/* The masthead opens the month, whole. */}
        <button className="rail-datum" onClick={() => navigate(to.calendar())}>
          <span className="rail-numeral">{day}</span>
          <span className="rail-monthyear">
            {month}
            <br />
            {year}
          </span>
        </button>
      </div>

      <div className="rail-month">
        <MonthGrid
          month={monthNow()}
          written={written}
          onPick={(iso) => navigate(to.day(iso))}
        />
      </div>

      <div className="rail-rule" />

      <div className="scroll rail-books">
        <div className="rail-books-head">
          <span className="section-label">Notebooks</span>
          <span className="grow" />
          <button className="link-caps" onClick={onManage}>
            Manage
          </button>
        </div>

        {books.map((book) => (
          <button
            key={book.id}
            className={`book-row${book.id === activeId ? ' active' : ''}`}
            onClick={() => onPick(book.id)}
          >
            <span className="book-mark" />
            <span className="book-dot" style={{ background: book.color }} />
            <span className="book-name">{book.name}</span>
            <span className="book-count">{counts[book.id] ?? 0}</span>
          </button>
        ))}

        <button className="book-row book-add" onClick={onManage}>
          <span className="book-dot dashed" />
          <span className="book-name">Add a notebook</span>
        </button>
      </div>

      <div className="rail-foot">
        <div className="rail-foot-line">
          <button className="link-quiet" onClick={() => navigate(to.trash())}>
            Trash
          </button>
          <button className="link-quiet" onClick={() => navigate(to.settings())}>
            Settings
          </button>
        </div>
      </div>
    </aside>
  )
}
