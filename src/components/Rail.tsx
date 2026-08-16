import { livePages, notebookCounts } from '../lib/db'
import { isoDay, isToday, mastheadParts, weekOf, WEEKDAY_LETTERS } from '../lib/format'
import type { Page } from '../lib/model'
import { useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

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
  const pages = useLive<Page[]>(() => livePages(), [], [])
  const { weekday, day, month, year } = mastheadParts()

  /* A brass dot under any day that has pages. */
  const written = new Set(pages.map((page) => page.entryDate ?? isoDay(page.updated)))

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
        <div className="rail-datum">
          <span className="rail-numeral">{day}</span>
          <span className="rail-monthyear">
            {month}
            <br />
            {year}
          </span>
        </div>
      </div>

      <div className="rail-week">
        <div className="rail-week-row">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} className="rail-week-letter">
              {letter}
            </span>
          ))}
        </div>
        <div className="rail-week-row rail-week-days">
          {weekOf().map((date) => {
            const today = isToday(date)
            return (
              <span key={date.toISOString()} className="rail-day">
                {today ? (
                  <span className="rail-today">{date.getDate()}</span>
                ) : (
                  <>
                    <span className="rail-day-number">{date.getDate()}</span>
                    <span
                      className={`rail-day-dot${written.has(isoDay(date.getTime())) ? ' on' : ''}`}
                    />
                  </>
                )}
              </span>
            )
          })}
        </div>
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
