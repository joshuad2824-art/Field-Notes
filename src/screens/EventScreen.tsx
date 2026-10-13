import { EventRepeat } from '../components/EventRepeat'
import { expandEvents, recurrenceSummary } from '../lib/event-recurrence'
import { Icon } from '../components/Icon'
import { eventRangeError } from '../lib/event-range'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDismiss } from '../lib/dismiss'
import { eventDetails, getEvent, saveEvent, deleteEvent, type EventDraft } from '../lib/events'
import { createPage, livePages, patchPage } from '../lib/db'
import { isoDay, readableDay, clock, repeatLine } from '../lib/format'
import { handoffToAppleCalendar } from '../lib/ical'
import { titleOf, type FieldEvent, type Page } from '../lib/model'
import { notebookForPage } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

const emptyDraft = (date?: string): EventDraft => ({
  title: '',
  date: date ?? isoDay(),
  calendarTarget: 'Joshua',
})

export function EventScreen({
  id,
  date,
  occurrence,
  notebook,
}: {
  id?: string
  date?: string
  occurrence?: string
  notebook: string
}) {
  const event = useLive<FieldEvent | undefined>(
    () => (id ? getEvent(id) : Promise.resolve(undefined)),
    [id],
    undefined,
  )
  const pages = useLive<Page[]>(livePages, [], [])
  const [editing, setEditing] = useState(!id)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(date))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  /* The pill's + is this form's ✓ while it is open, so the screen tells the
     frame when it is, and what saving it is called. */
  const formOpen = editing && (!id || !!event)
  const saveLabel = event?.recurrence ? 'Save the series' : 'Save event'
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('field-notes:event-form', { detail: formOpen ? saveLabel : '' }))
    return () => {
      window.dispatchEvent(new CustomEvent('field-notes:event-form', { detail: '' }))
    }
  }, [formOpen, saveLabel])
  useEffect(() => {
    const submit = () => formRef.current?.requestSubmit()
    window.addEventListener('field-notes:save-event', submit)
    return () => window.removeEventListener('field-notes:save-event', submit)
  }, [])
  useDismiss(menu, () => setMenu(false))
  useEffect(() => {
    if (!menu) return
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [menu])
  const shown =
    event && occurrence
      ? (expandEvents([event], occurrence, occurrence).find((e) => e.date === occurrence) ??
        event)
      : event
  const linkedPage = pages.find((page) => page.id === event?.pageId)

  useEffect(() => {
    if (event && !editing)
      setDraft({
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        note: event.note,
        recurrence: event.recurrence,
        pageId: event.pageId,
        calendarTarget: event.calendarTarget ?? 'Joshua',
      })
  }, [event, editing])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!draft.title.trim()) return setNotice('Give the event a title.')
    const rangeError = eventRangeError(draft)
    if (rangeError) return setNotice(rangeError)
    setBusy(true)
    setNotice('')
    try {
      const saved = await saveEvent(draft, id)
      navigate(to.event(saved.id), { replace: !id })
      setEditing(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the event.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eventDetails(draft))
      setNotice('Event details copied.')
    } catch {
      setNotice('Could not copy the details on this device.')
    }
  }

  const makePage = async () => {
    if (!event) return
    setBusy(true)
    setNotice('')
    try {
      const page = await createPage(notebook, `# ${event.title}\n\n`)
      await patchPage(page.id, { entryDate: shown?.date ?? event.date })
      await saveEvent({ ...event, pageId: page.id }, event.id)
      navigate(to.page(page.id))
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not make a page for this event.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!event) return
    setBusy(true)
    try {
      await deleteEvent(event.id)
      navigate(to.day(shown?.date ?? event.date), { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the event.')
      setBusy(false)
    }
  }

  const exportIcs = async () => {
    if (!event) return
    try {
      const result = await handoffToAppleCalendar(event)
      setNotice(
        `${result === 'shared' ? 'Event file shared' : 'Event file downloaded'}. When Apple Calendar asks, choose ${event.calendarTarget ?? 'Joshua'}. Changes in Field Notes will not update Apple Calendar automatically.`,
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNotice('Could not prepare the Apple Calendar event file.')
    }
  }

  return (
    <div className="app event-app">
      <div className="statusband" />
      <main className="event-screen scroll">
        <div className={`event-wrap${editing && event ? ' event-split' : ''}`}>
          {event && !event.deleted && !editing ? (
            <div className="event-top" ref={menuRef}>
              <button
                className="overview-back"
                onClick={() => setEditing(true)}
                aria-label="Edit event"
                title="Edit event"
              >
                <Icon name="edit" />
              </button>
              <button
                className={`overview-back${menu ? ' on' : ''}`}
                onClick={() => setMenu(!menu)}
                aria-label="More event actions"
                title="More event actions"
                aria-haspopup="menu"
                aria-expanded={menu}
              >
                <Icon name="more" />
              </button>
              {menu ? (
                <div className="event-menu" role="menu" aria-label="Event actions">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      setConfirmDelete(true)
                    }}
                  >
                    Delete
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      void exportIcs()
                    }}
                  >
                    Export calendar file (.ics)
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      void copy()
                    }}
                  >
                    Copy details
                  </button>
                  <button role="menuitem" onClick={() => navigate(to.day(shown?.date ?? event.date))}>
                    Day agenda
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => navigate(to.calendar((shown?.date ?? event.date).slice(0, 7)))}
                  >
                    Full calendar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {editing ? (
            <form ref={formRef} className="event-form" onSubmit={(e) => void save(e)}>
              <h1>{id ? (event?.recurrence ? 'Event series' : 'Edit event') : 'New event'}</h1>
              {id && event?.recurrence ? (
                <p className="event-date-help">
                  Changes apply to every occurrence in this series.
                </p>
              ) : null}
              <label className="event-title-field">
                Title
                <input
                  required
                  maxLength={240}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label>
                Start date
                <input
                  required
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label>
                End date<span className="sr-only"> optional</span>
                <input
                  type="date"
                  min={draft.date}
                  value={draft.endDate ?? ''}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value || undefined })}
                />
              </label>
              <div className="event-form-times">
                <label>
                  Start time<span className="sr-only"> optional</span>
                  <input
                    type="time"
                    value={draft.startTime ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value || undefined })
                    }
                  />
                </label>
                <label>
                  End time<span className="sr-only"> optional</span>
                  <input
                    type="time"
                    value={draft.endTime ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value || undefined })
                    }
                  />
                </label>
              </div>
              <EventRepeat draft={draft} onChange={setDraft} />
              <label>
                Location<span className="sr-only"> optional</span>
                <input
                  maxLength={500}
                  value={draft.location ?? ''}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </label>
              <label>
                Note<span className="sr-only"> optional</span>
                <textarea
                  maxLength={10000}
                  rows={5}
                  value={draft.note ?? ''}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
              <label>
                Apple Calendar
                <select
                  value={draft.calendarTarget ?? 'Joshua'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      calendarTarget: e.target.value as 'Joshua' | 'Family',
                    })
                  }
                >
                  <option value="Joshua">Joshua · personal</option>
                  <option value="Family">Family · shared</option>
                </select>
              </label>
              <label>
                Linked page<span className="sr-only"> optional</span>
                <select
                  value={draft.pageId ?? ''}
                  onChange={(e) => setDraft({ ...draft, pageId: e.target.value || undefined })}
                >
                  <option value="">No linked page</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {notebookForPage(page.notebook).name} · {titleOf(page.body)}
                    </option>
                  ))}
                </select>
              </label>
              {notice ? (
                <p className="event-notice" role="status">
                  {notice}
                </p>
              ) : null}
              {id ? (
                <div className="event-form-actions">
                  <button
                    className="event-copy"
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setNotice('')
                    }}
                    aria-label="Cancel"
                    title="Cancel"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}
          {event && !event.deleted ? (
            <article className="event-detail">
              <span className="section-label">
                {readableDay(shown?.date ?? event.date)}
                {shown?.endDate ? ` – ${readableDay(shown.endDate)}` : ''}
              </span>
              <h1>
                <button
                  className="event-title-edit"
                  onClick={() => setEditing(true)}
                  title="Edit event"
                >
                  {event.title}
                </button>
              </h1>
              {event.conflictOf ? (
                <p className="event-conflict">
                  A conflicting edit was kept as this copy. Review both events.
                </p>
              ) : null}
              <dl>
                <div>
                  <dt>When</dt>
                  <dd>
                    {event.startTime
                      ? `${clock(event.startTime)}${event.endTime ? ` – ${clock(event.endTime)}` : ''}`
                      : 'All day'}
                  </dd>
                </div>
                {event.location ? (
                  <div className="event-where">
                    <dd>
                      <a
                        className="event-location"
                        href={`https://maps.apple.com/?q=${encodeURIComponent(event.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Maps"
                      >
                        {event.location}
                      </a>
                    </dd>
                  </div>
                ) : null}
                <div className="event-calendar">
                  <dd>{event.calendarTarget ?? 'Joshua'} · Apple Calendar handoff</dd>
                </div>
              </dl>
              {event.recurrence ? (
                <p className="event-series-summary">{repeatLine(recurrenceSummary(event.recurrence))}</p>
              ) : null}
              {event.note ? <p className="event-detail-note">{event.note}</p> : null}
              <div className="event-linked">
                <span className="section-label">
                  {event.recurrence ? 'Page for this series' : 'Page for this event'}
                </span>
                {linkedPage ? (
                  <button
                    className="overview-back"
                    onClick={() => navigate(to.page(linkedPage.id))}
                  >
                    {titleOf(linkedPage.body)} <Icon name="source" />
                  </button>
                ) : (
                  <button
                    className="overview-action"
                    disabled={busy}
                    onClick={() => void makePage()}
                    aria-label="Create a page"
                    title="Create a page"
                  >
                    <Icon name="new-page" />
                  </button>
                )}
              </div>
              {confirmDelete ? (
                <div className="event-delete-confirm">
                  <p>
                    {event.recurrence
                      ? 'Delete every occurrence in this series?'
                      : 'Delete this event?'}{' '}
                    You can bring it back from Trash for thirty days.
                  </p>
                  <button
                    className="event-delete"
                    disabled={busy}
                    onClick={() => void remove()}
                    aria-label="Delete it"
                    title="Delete it"
                  >
                    Delete it
                  </button>
                  <button
                    className="event-copy"
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Keep it"
                    title="Keep it"
                  >
                    Keep it
                  </button>
                </div>
              ) : null}
              {notice ? (
                <p className="event-notice" role="status">
                  {notice}
                </p>
              ) : null}
            </article>
          ) : !editing ? (
            <p className="overview-empty">This event is not available on this device.</p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
