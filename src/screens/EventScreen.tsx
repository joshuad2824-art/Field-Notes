import { useEffect, useState, type FormEvent } from 'react'
import { eventDetails, getEvent, saveEvent, type EventDraft } from '../lib/events'
import { isoDay, readableDay } from '../lib/format'
import type { FieldEvent } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

const emptyDraft = (date?: string): EventDraft => ({ title: '', date: date ?? isoDay() })

export function EventScreen({ id, date, notebook }: { id?: string; date?: string; notebook: string }) {
  const event = useLive<FieldEvent | undefined>(() => id ? getEvent(id) : Promise.resolve(undefined), [id], undefined)
  const [editing, setEditing] = useState(!id)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(date))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (event && !editing) setDraft({
      title: event.title, date: event.date, startTime: event.startTime,
      endTime: event.endTime, location: event.location, note: event.note,
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
              </dl>
              {event.note ? <p className="event-detail-note">{event.note}</p> : null}
              <button className="overview-back" onClick={() => navigate(to.day(event.date))}>See the day ↗</button>
            </article>
          ) : <p className="overview-empty">This event is not available on this device.</p>}
        </div>
      </main>
    </div>
  )
}
