import { recurrenceError, recurrencePreview, recurrenceSummary, dateWeekday, WEEKDAYS, type EventRecurrence } from '../lib/event-recurrence'
import { readableDay } from '../lib/format'
import type { EventDraft } from '../lib/events'

export function EventRepeat({ draft, onChange }: { draft: EventDraft; onChange: (draft: EventDraft) => void }) {
  const r = draft.recurrence
  const set = (rule?: EventRecurrence) => onChange({ ...draft, recurrence: rule })
  const patch = (values: Partial<EventRecurrence>) => r && set({ ...r, ...values })
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? dateWeekday(draft.date) : 0
  const changeFrequency = (frequency: string) => set(frequency === 'none' ? undefined : {
    frequency: frequency as EventRecurrence['frequency'], interval: 1,
    ...(frequency === 'weekly' ? { weekdays: [weekday] } : {}),
    ...(frequency === 'monthly' ? { monthDay: Number(draft.date.slice(8)) || 1 } : {}),
    ...(r?.until ? { until: r.until } : r?.count ? { count: r.count } : {}),
  })
  const error = recurrenceError(r, draft.date)
  const preview = !error && r ? recurrencePreview(draft) : []
  const ending = r?.until !== undefined ? 'until' : r?.count !== undefined ? 'count' : 'never'
  return <fieldset className="event-repeat"><legend>Repeat</legend>
    <label>Schedule<select value={r?.frequency ?? 'none'} onChange={e => changeFrequency(e.target.value)}>
      <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
    </select></label>
    {r ? <>
      <label>Every <span>{{ daily:'days',weekly:'weeks',monthly:'months',yearly:'years' }[r.frequency]}</span><input type="number" min="1" max="99" required value={Number.isFinite(r.interval) ? r.interval : ''} onChange={e => patch({ interval: e.target.valueAsNumber })} /></label>
      {r.frequency === 'weekly' ? <div className="repeat-weekdays" role="group" aria-label="Repeat on weekdays">{WEEKDAYS.map((day, n) => <button key={day} type="button" aria-label={day} aria-pressed={r.weekdays?.includes(n) ?? false} onClick={() => patch({ weekdays: r.weekdays?.includes(n) ? r.weekdays.filter(d => d !== n) : [...(r.weekdays ?? []), n].sort() })}>{day.slice(0,3)}</button>)}</div> : null}
      {r.frequency === 'monthly' ? <>
        <label>Monthly pattern<select value={r.monthDay !== undefined ? 'date' : 'weekday'} onChange={e => e.target.value === 'date' ? set({ ...r, monthDay: Number(draft.date.slice(8)) || 1, monthWeek: undefined, weekday: undefined }) : set({ ...r, monthDay: undefined, monthWeek: Math.min(5, Math.ceil(Number(draft.date.slice(8))/7)) || 1, weekday })}><option value="date">A date each month</option><option value="weekday">A weekday each month</option></select></label>
        {r.monthDay !== undefined ? <label>Day of month<select value={r.monthDay} onChange={e => patch({ monthDay: Number(e.target.value) })}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}<option value="-1">Last day</option></select></label> : <div className="repeat-month-weekday"><label>Which week<select value={r.monthWeek} onChange={e => patch({ monthWeek: Number(e.target.value) })}>{['First','Second','Third','Fourth','Fifth'].map((name,n)=><option key={name} value={n+1}>{name}</option>)}<option value="-1">Last</option></select></label><label>Weekday<select value={r.weekday} onChange={e => patch({ weekday: Number(e.target.value) })}>{WEEKDAYS.map((name,n)=><option key={name} value={n}>{name}</option>)}</select></label></div>}
      </> : null}
      <label>Ends<select value={ending} onChange={e => patch({ until: e.target.value === 'until' ? draft.date : undefined, count: e.target.value === 'count' ? 12 : undefined })}><option value="never">Never</option><option value="until">On a date</option><option value="count">After a number of occurrences</option></select></label>
      {ending === 'until' ? <label>Last repeat date<input required type="date" min={draft.date} value={r.until ?? ''} onChange={e => patch({ until: e.target.value })} /></label> : null}
      {ending === 'count' ? <label>Occurrences<input required type="number" min="1" max="9999" value={Number.isFinite(r.count) ? r.count : ''} onChange={e => patch({ count: e.target.valueAsNumber })} /></label> : null}
      {error ? <p className="event-date-help" role="status">{error}</p> : <div className="repeat-preview" aria-live="polite"><p>{recurrenceSummary(r)}</p>{preview.length ? <><span>Next dates</span><ul>{preview.map(day => <li key={day}>{readableDay(day)}</li>)}</ul>{preview[0] !== draft.date ? <small>The first event will start on {readableDay(preview[0])}.</small> : null}</> : <small>No occurrences before the end date. Adjust the schedule.</small>}</div>}
      {(r.monthDay && r.monthDay > 28) || r.monthWeek === 5 ? <p className="event-date-help">Months without this date or weekday are skipped. Choose “Last day” or “Last” for a repeat in every month.</p> : null}
      {r.frequency === 'yearly' && draft.date.slice(5) === '02-29' ? <p className="event-date-help">February 29 repeats in leap years.</p> : null}
    </> : null}
  </fieldset>
}
