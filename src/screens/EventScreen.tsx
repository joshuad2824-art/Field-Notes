import { useEffect, useState, type FormEvent } from 'react'
import { eventDetails, getEvent, saveEvent, deleteEvent, type EventDraft } from '../lib/events'
import { createPage, livePages, patchPage } from '../lib/db'
import { isoDay, readableDay } from '../lib/format'
import { handoffToAppleCalendar } from '../lib/ical'
import { titleOf, type FieldEvent, type Page } from '../lib/model'
import { notebookForPage } from '../lib/notebooks'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

const emptyDraft = (date?: string): EventDraft => ({ title: '', date: date ?? isoDay(), calendarTarget: 'Joshua' })

export function EventScreen({ id, date, notebook }: { id?: string; date?: string; notebook: string }) {
  const event = useLive<FieldEvent | undefined>(() => id ? getEvent(id) : Promise.resolve(undefined), [id], undefined)
  const pages = useLive<Page[]>(livePages, [], [])
  const [editing, setEditing] = useState(!id)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(date))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const linkedPage = pages.find((page) => page.id === event?.pageId)

  useEffect(() => {
    if (event && !editing) setDraft({
      title: event.title, date: event.date, startTime: event.startTime,
      endTime: event.endTime, location: event.location, note: event.note,
      pageId: event.pageId, calendarTarget: event.calendarTarget ?? 'Joshua',
    })
  }, [event, editing])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) return setNotice('Give the event a title.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return setNotice('Choose a date.')
    if (draft.endTime && !draft.startTime) return setNotice('Add a start time before an end time.')
    if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) return setNotice('End time must follow start time.')
    setBusy(true)
    setNotice('')
    try {
      const saved = await saveEvent(draft, id)
      navigate(to.event(saved.id), { replace: !id })
      setEditing(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the event.')
    } finally { setBusy(false) }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eventDetails(draft))
      setNotice('Event details copied.')
    } catch { setNotice('Could not copy the details on this device.') }
  }

  const makePage = async () => {
    if (!event) return
    setBusy(true)
    setNotice('')
    try {
      const page = await createPage(notebook, `# ${event.title}\n\n`)
      await patchPage(page.id, { entryDate: event.date })
      await saveEvent({ ...event, pageId: page.id }, event.id)
      navigate(to.page(page.id))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not make a page for this event.')
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!event) return
    setBusy(true)
    try {
      await deleteEvent(event.id)
      navigate(to.day(event.date), { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the event.')
      setBusy(false)
    }
  }

  const exportIcs = async () => {
    if (!event) return
    try {
      const result = await handoffToAppleCalendar(event)
      setNotice(`${result === 'shared' ? 'Event file shared' : 'Event file downloaded'}. When Apple Calendar asks, choose ${event.calendarTarget ?? 'Joshua'}. Changes in Field Notes will not update Apple Calendar automatically.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNotice('Could not prepare the Apple Calendar event file.')
    }
  }

  return (
    <div className="app">
      <div className="statusband" />
      <main className="event-screen scroll">
        <div className="event-wrap">
          <div className="event-top">
            <button className="overview-back" onClick={() => back(to.notebook(notebook))}>‹ Back</button>
            <button className="overview-back" onClick={() => navigate(to.notebook(notebook))}>Notebook</button>
            {event && !editing ? <button className="overview-back" onClick={() => setEditing(true)}>Edit event</button> : null}
          </div>
          {editing ? (
            <form className="event-form" onSubmit={(e) => void save(e)}>
              <span className="section-label">Field Notes calendar</span>
              <h1>{id ? 'Edit event' : 'New event'}</h1>
              <label>Title<input required maxLength={240} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label>Date<input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
              <div className="event-form-times">
                <label>Start time <span>optional</span><input type="time" value={draft.startTime ?? ''} onChange={(e) => setDraft({ ...draft, startTime: e.target.value || undefined })} /></label>
                <label>End time <span>optional</span><input type="time" value={draft.endTime ?? ''} onChange={(e) => setDraft({ ...draft, endTime: e.target.value || undefined })} /></label>
              </div>
              <label>Location <span>optional</span><input maxLength={500} value={draft.location ?? ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
              <label>Note <span>optional</span><textarea maxLength={10000} rows={5} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
              <label>Apple Calendar
                <select value={draft.calendarTarget ?? 'Joshua'} onChange={(e) => setDraft({ ...draft, calendarTarget: e.target.value as 'Joshua' | 'Family' })}>
                  <option value="Joshua">Joshua · personal</option>
                  <option value="Family">Family · shared</option>
                </select>
              </label>
              <label>Linked page <span>optional</span>
                <select value={draft.pageId ?? ''} onChange={(e) => setDraft({ ...draft, pageId: e.target.value || undefined })}>
                  <option value="">No linked page</option>
                  {pages.map((page) => <option key={page.id} value={page.id}>{notebookForPage(page.notebook).name} · {titleOf(page.body)}</option>)}
                </select>
              </label>
              {notice ? <p className="event-notice" role="status">{notice}</p> : null}
              <div className="event-form-actions">
                <button className="overview-action primary" type="submit" disabled={busy}>Save event</button>
                <button className="event-copy" type="button" onClick={() => void copy()}>Copy details for Apple Calendar</button>
                {id ? <button className="event-copy" type="button" onClick={() => { setEditing(false); setNotice('') }}>Cancel</button> : null}
              </div>
            </form>
          ) : event && !event.deleted ? (
            <article className="event-detail">
              <span className="section-label">{readableDay(event.date)}</span>
              <h1>{event.title}</h1>
              {event.conflictOf ? <p className="event-conflict">A conflicting edit was kept as this copy. Review both events.</p> : null}
              <dl>
                <div><dt>When</dt><dd>{event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ''}` : 'All day'}</dd></div>
                {event.location ? <div><dt>Where</dt><dd>{event.location}</dd></div> : null}
                <div><dt>Calendar</dt><dd>{event.calendarTarget ?? 'Joshua'} · Apple Calendar handoff</dd></div>
              </dl>
              {event.note ? <p className="event-detail-note">{event.note}</p> : null}
              <div className="event-linked">
                <span className="section-label">Page for this event</span>
                {linkedPage ? <button className="overview-back" onClick={() => navigate(to.page(linkedPage.id))}>{titleOf(linkedPage.body)} ↗</button> : (
                  <button className="overview-action" disabled={busy} onClick={() => void makePage()}>Create a page</button>
                )}
              </div>
              <div className="event-detail-actions">
                <button className="overview-action event-ics" onClick={() => void exportIcs()}>Send to Apple Calendar</button>
                <button className="overview-back" onClick={() => navigate(to.day(event.date))}>See the day ↗</button>
                <button className="event-delete" onClick={() => setConfirmDelete(true)}>Delete event</button>
              </div>
              <p className="event-handoff-note">Choose <strong>{event.calendarTarget ?? 'Joshua'}</strong> when importing into Apple Calendar. This is a one-time handoff; later edits need another import. {event.startTime && !event.endTime ? 'With no end time set, the file uses one hour.' : ''}</p>
              {confirmDelete ? <div className="event-delete-confirm">
                <p>Delete this event? You can restore it from Deleted.</p>
                <button className="event-delete" disabled={busy} onClick={() => void remove()}>Delete it</button>
                <button className="event-copy" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </div> : null}
              {notice ? <p className="event-notice" role="status">{notice}</p> : null}
            </article>
          ) : <p className="overview-empty">This event is not available on this device.</p>}
        </div>
      </main>
    </div>
  )
}
