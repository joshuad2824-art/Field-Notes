import { Icon } from './Icon'
import { daysWritten, notebookCounts } from '../lib/db'
import { mastheadParts } from '../lib/format'
import { monthNow } from '../lib/calendar'
import { JOURNAL_NOTEBOOK } from '../lib/model'
import { journalBook, useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { allSienaItems } from '../lib/siena-items'
import { daysWithEvents } from '../lib/events'
import { MonthGrid } from './MonthGrid'
import { SyncMark } from './SyncMark'
import { WeatherLine } from './WeatherLine'

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
  const eventDays = useLive<Set<string>>(daysWithEvents, [], new Set())
  const sienaItems = useLive(allSienaItems, [], [])
  const unseen = sienaItems.filter((item) => !item.seenAt).length
  const { weekday, day, month, year } = mastheadParts()

  return (
    <aside className="rail">
      <div className="rail-wordmark">
        {/* The mark is decorative once the name beside it is real text — an
            alt here would announce "Field Notes" twice. The portrait is
            cropped below the beak on purpose: the coat and the flat cap are
            near-black forest green, more than half of them fall under 1.5:1
            against the rail, and cutting them off is what makes a plate or a
            disc unnecessary. The bird faces right, into the name. */}
        <img className="rail-mark" src="/mark-puffin.png" alt="" />
        {/* Two spans rather than a max-width that forces a wrap: a wrap that
            depends on a measurement breaks the first time the type moves. */}
        <span className="rail-name">
          <span>Field</span>
          <span>Notes</span>
        </span>
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
          events={eventDays}
          onPick={(iso) => navigate(to.day(iso))}
        />
      </div>

      {/* Under the month, because it belongs to the same thought — what day
          it is and what the day is like. Nothing when there is no reading. */}
      <WeatherLine />

      <div className="rail-rule" />

      <div className="rail-destinations">
        <button className={`rail-overview${location.pathname === '/overview' || location.pathname === '/' ? ' active' : ''}`} aria-current={location.pathname === '/overview' || location.pathname === '/' ? 'page' : undefined} aria-label="Overview" title="Overview" onClick={() => navigate(to.overview())}>
          <Icon name="overview" />
        </button>
        <button className={`rail-overview rail-siena-link${location.pathname === '/from-siena' ? ' active' : ''}`} aria-label={`From Siena${unseen ? `, ${unseen} unseen` : ''}`} aria-current={location.pathname === '/from-siena' ? 'page' : undefined} title="From Siena" onClick={() => navigate(to.fromSiena())}>
          <Icon name="from-siena" />
          {unseen ? <span className="siena-badge" aria-label={`${unseen} unseen`}>{unseen}</span> : null}
        </button>

      </div>

      <div className="scroll rail-books">
        <div className="rail-books-head">
          <span className="section-label">Notebooks</span>
          <span className="grow" />
          <button className="icon-control" aria-label="Manage notebooks" title="Manage notebooks" onClick={onManage}>
            <Icon name="manage-notebooks" />
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

        <button
          className={`book-row rail-journal${activeId === JOURNAL_NOTEBOOK ? ' active' : ''}`}
          onClick={() => onPick(JOURNAL_NOTEBOOK)}
        >
          <span className="book-mark" />
          <span className="book-dot" style={{ background: journalBook().color }} />
          <span className="book-name">{journalBook().name}</span>
          <span className="book-count">{counts[JOURNAL_NOTEBOOK] ?? 0}</span>
        </button>

        <button className="book-row book-add" onClick={onManage}>
          <span className="book-dot dashed" />
          <span className="book-name">Add a notebook</span>
        </button>
      </div>

      <div className="rail-foot">
        <div className="rail-foot-line">
          <button className="icon-control" aria-label="Trash" title="Trash" onClick={() => navigate(to.trash())}>
            <Icon name="trash" />
          </button>
          <button className="icon-control" aria-label="Settings" title="Settings" onClick={() => navigate(to.settings())}>
            <Icon name="settings" />
          </button>
        </div>
        {/* The foot is still Trash and Settings and nothing else — this is a
            state, not a third back room, and most of the time it is one word
            that says everything already arrived. */}
        <SyncMark />
      </div>
    </aside>
  )
}
