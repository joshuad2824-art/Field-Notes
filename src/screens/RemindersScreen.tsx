import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { DueLabel } from '../components/DueLabel'
import { Icon } from '../components/Icon'
import { RouteLink } from '../components/DeskHeader'
import { dueStamp } from '../lib/format'
import type { SienaItem } from '../lib/model'
import { ST_JOHN_NOTEBOOK } from '../lib/notebook-desk'
import { notebookOf, useNotebooks } from '../lib/notebooks'
import {
  addReminder,
  editReminder,
  isWorkReminder,
  personalReminders,
  reminderState,
  removeReminder,
  reopenReminder,
} from '../lib/reminders'
import { to } from '../lib/router'
import { useSettings } from '../lib/settings'
import { completeReminder } from '../lib/siena-items'
import { coverColor } from '../lib/theme'
import { useSienaItems } from '../lib/useSienaItems'

/* Reminders, in a room of their own (November 2026). Every personal reminder
   — the ones Siena leaves and the ones written here — in the order they come
   due, with adding, editing, completing and removing all on this one screen.
   St. John's reminders are work and stay on the St. John desk; this room only
   says how many are open there and goes to them. */

const pad = (n: number) => String(n).padStart(2, '0')
const localInput = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const at = (day: Date, hour: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).getTime()

/* The three times a reminder is usually for, one tap each. */
function presets(now = new Date()) {
  const evening = now.getHours() < 17 ? at(now, 18) : (() => {
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next.getTime()
  })()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7))
  return [
    { label: now.getHours() < 17 ? 'This evening' : 'In an hour', at: evening },
    { label: 'Tomorrow', at: at(tomorrow, 9) },
    { label: 'Next week', at: at(monday, 9) },
  ]
}

type Group = { key: string; label: string; items: SienaItem[] }

function groupByDue(items: SienaItem[], now = new Date()): Group[] {
  const today = at(now, 0)
  const tomorrow = today + 86_400_000
  const after = tomorrow + 86_400_000
  const week = today + 7 * 86_400_000
  const groups: Group[] = [
    { key: 'late', label: 'Overdue', items: [] },
    { key: 'today', label: 'Today', items: [] },
    { key: 'tomorrow', label: 'Tomorrow', items: [] },
    { key: 'week', label: 'This week', items: [] },
    { key: 'later', label: 'Later', items: [] },
  ]
  for (const item of items) {
    const due = item.dueAt ?? Infinity
    const g = due < now.getTime() ? 0 : due < tomorrow ? 1 : due < after ? 2 : due < week ? 3 : 4
    groups[g].items.push(item)
  }
  return groups.filter((g) => g.items.length)
}

export function RemindersScreen() {
  const items = useSienaItems()
  const books = useNotebooks()
  const settings = useSettings()
  const personalBooks = useMemo(() => books.filter((b) => b.id !== ST_JOHN_NOTEBOOK), [books])
  const fallback =
    personalBooks.find((b) => b.id === settings.notebook)?.id ??
    personalBooks.find((b) => b.id === 'field-notes')?.id ??
    personalBooks[0]?.id ??
    ''

  const mine = personalReminders(items)
  const open = mine
    .filter((item) => reminderState(item) === 'open')
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.created - b.created)
  const weekAgo = Date.now() - 7 * 86_400_000
  const recentlyClosed = mine
    .filter((item) => ['done', 'removed'].includes(reminderState(item)) && (item.completedAt ?? 0) > weekAgo)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const workOpen = items.filter(
    (item) => item.type === 'reminder' && isWorkReminder(item) && reminderState(item) === 'open',
  ).length

  const [title, setTitle] = useState('')
  const [due, setDue] = useState(() => localInput(presets()[0].at))
  const [book, setBook] = useState('')
  const [problem, setProblem] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo: () => void } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  /* + in the pill, from anywhere in this room. */
  useEffect(() => {
    const focus = () => {
      input.current?.focus()
      input.current?.scrollIntoView({ block: 'center' })
    }
    window.addEventListener('field-notes:new-reminder', focus)
    return () => window.removeEventListener('field-notes:new-reminder', focus)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await addReminder({ title, dueAt: new Date(due).getTime(), notebook: book || fallback })
      setTitle('')
      setProblem('')
      input.current?.focus()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not add that reminder.')
    }
  }

  const complete = async (item: SienaItem) => {
    await completeReminder(item.id)
    setNotice({ text: `Done · ${item.title ?? item.body}`, undo: () => void reopenReminder(item.id) })
  }
  const remove = async (item: SienaItem) => {
    await removeReminder(item.id)
    setEditing(null)
    setNotice({ text: `Removed · ${item.title ?? item.body}`, undo: () => void reopenReminder(item.id) })
  }

  const groups = groupByDue(open)
  const showBooks = new Set(open.map((item) => item.notebook)).size > 1

  return (
    <div className="app board-app reminders-app">
      <main className="reminders-room board-collection scroll">
        <header className="collection-header reminders-head">
          <h1 id="desk-heading">Reminders</h1>
          {open.length ? <span className="reminders-count">{open.length} open</span> : null}
        </header>

        <form className="reminder-add" onSubmit={(e) => void add(e)}>
          <input
            ref={input}
            className="reminder-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a reminder"
            aria-label="New reminder"
            maxLength={240}
            enterKeyHint="done"
          />
          <div className="reminder-add-when" role="group" aria-label="When">
            {presets().map((p) => (
              <button
                type="button"
                key={p.label}
                aria-pressed={due === localInput(p.at)}
                onClick={() => setDue(localInput(p.at))}
              >
                {p.label}
              </button>
            ))}
            <input type="datetime-local" aria-label="Due" value={due} onChange={(e) => setDue(e.target.value)} required />
            {personalBooks.length > 1 ? (
              <select aria-label="Notebook" value={book || fallback} onChange={(e) => setBook(e.target.value)}>
                {personalBooks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : null}
            <button type="submit" className="reminder-add-go" aria-label="Add reminder" title="Add reminder" disabled={!title.trim()}>
              <Icon name="add" />
            </button>
          </div>
          {problem ? <p role="alert" className="reminder-problem">{problem}</p> : null}
        </form>

        {notice ? (
          <p className="reminder-notice" role="status">
            <span>{notice.text}</span>
            <button
              onClick={() => {
                notice.undo()
                setNotice(null)
              }}
            >
              Undo
            </button>
          </p>
        ) : null}

        {groups.length ? (
          groups.map((group) => (
            <section key={group.key} className={`reminder-group reminder-group-${group.key}`} aria-label={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) =>
                editing === item.id ? (
                  <ReminderEditor
                    key={item.id}
                    item={item}
                    books={personalBooks}
                    onDone={() => setEditing(null)}
                    onRemove={() => void remove(item)}
                  />
                ) : (
                  <div className="reminder-row" key={item.id}>
                    <button className="reminder-row-check" aria-label={`Mark ${item.title ?? item.body} done`} title="Mark done" onClick={() => void complete(item)}>
                      <span aria-hidden="true" />
                    </button>
                    <button className="reminder-row-words" onClick={() => setEditing(item.id)} aria-label={`Edit ${item.title ?? item.body}`}>
                      <strong>{item.title ?? item.body}</strong>
                      {item.title && item.body.trim() !== item.title.trim() ? <span className="reminder-row-note">{firstLine(item.body)}</span> : null}
                      <small>
                        {item.dueAt ? <DueLabel at={item.dueAt} /> : null}
                        {showBooks && item.notebook ? <BookName id={item.notebook} /> : null}
                      </small>
                    </button>
                  </div>
                ),
              )}
            </section>
          ))
        ) : (
          <p className="reminders-empty">Nothing to remember right now.</p>
        )}

        {recentlyClosed.length ? (
          <details className="reminder-closed">
            <summary>Done this week · {recentlyClosed.length}</summary>
            {recentlyClosed.map((item) => (
              <div className="reminder-row is-closed" key={item.id}>
                <span className="reminder-row-check" aria-hidden="true"><span /></span>
                <div className="reminder-row-words">
                  <strong>{item.title ?? item.body}</strong>
                  <small>{reminderState(item) === 'removed' ? 'Removed' : 'Done'} {dueStamp(item.completedAt!)}</small>
                </div>
                <button className="reminder-reopen" onClick={() => void reopenReminder(item.id)}>Reopen</button>
              </div>
            ))}
          </details>
        ) : null}

        <nav className="reminders-foot" aria-label="Elsewhere">
          <RouteLink href={to.archive()}>
            <Icon name="restore" /> Archive
          </RouteLink>
          <RouteLink href={to.notebookDesk(ST_JOHN_NOTEBOOK)}>
            <Icon name="notebook" /> St. John{workOpen ? ` · ${workOpen} open` : ''}
          </RouteLink>
        </nav>
      </main>
    </div>
  )
}

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0]
  return line.length > 120 ? line.slice(0, 119) + '…' : line
}

function BookName({ id }: { id: string }) {
  const book = notebookOf(id)
  if (!book) return null
  return (
    <span className="reminder-row-book" style={{ '--dot': coverColor(book.color) } as CSSProperties}>
      {book.name}
    </span>
  )
}

function ReminderEditor({
  item,
  books,
  onDone,
  onRemove,
}: {
  item: SienaItem
  books: { id: string; name: string }[]
  onDone: () => void
  onRemove: () => void
}) {
  const words = item.title ?? item.body
  const [title, setTitle] = useState(words)
  const [note, setNote] = useState(item.body.trim() !== words.trim() ? item.body : '')
  const [due, setDue] = useState(localInput(item.dueAt ?? Date.now()))
  const [book, setBook] = useState(item.notebook ?? books[0]?.id ?? '')
  const [problem, setProblem] = useState('')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await editReminder(item.id, { title, note, dueAt: new Date(due).getTime(), notebook: book })
      onDone()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not save that change.')
    }
  }

  return (
    <form
      className="reminder-editor"
      onSubmit={(e) => void save(e)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onDone()
        }
      }}
    >
      <input ref={first} aria-label="Reminder" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240} />
      <textarea aria-label="Note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={note ? 3 : 1} />
      <div className="reminder-editor-row">
        <input type="datetime-local" aria-label="Due" value={due} onChange={(e) => setDue(e.target.value)} required />
        {books.length > 1 ? (
          <select aria-label="Notebook" value={book} onChange={(e) => setBook(e.target.value)}>
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}
        <span className="grow" />
        <button type="button" className="icon-control reminder-remove" aria-label="Remove reminder" title="Remove reminder" onClick={onRemove}>
          <Icon name="trash" />
        </button>
        <button type="button" className="icon-control" aria-label="Cancel" title="Cancel" onClick={onDone}>
          <Icon name="close" />
        </button>
        <button type="submit" className="icon-control reminder-save" aria-label="Save reminder" title="Save reminder">
          <Icon name="done" />
        </button>
      </div>
      {problem ? <p role="alert" className="reminder-problem">{problem}</p> : null}
    </form>
  )
}
