import { useEffect, useState, useSyncExternalStore } from 'react'
import { davisAgenda, type AgendaEntry } from '../davis/agenda'
import { davisSession, DAVIS_CALLBACK_URL } from '../davis/oauth'
import { DAVIS_SOURCE_URL, datesIn, shiftDate } from '../davis/wire'
import { Icon } from './Icon'

const messages = {
  setup: 'Davis calendar connection is not set up yet.',
  disconnected: 'Davis is disconnected. Your family agenda has been cleared from this view.',
  loading: 'Loading the family agenda…',
  denied: 'Davis access has ended. Reconnect with your household to see its agenda.',
  error: 'Davis could not be refreshed. This does not mean your calendar is empty.',
  offline: 'You’re offline. Davis could not be refreshed; any shown items are stale.',
  stale: 'These are previously fetched items. Refresh to check for changes.',
}
function entryLabel(entry: AgendaEntry) {
  return <><strong>{entry.title}</strong>{entry.location ? <span>{entry.location}</span> : null}<small>{entry.owner || ''}{entry.owner && entry.audience ? ' · ' : ''}{entry.audience === 'adults' ? 'Adults' : entry.audience === 'household' ? 'Household' : entry.audience || ''}</small></>
}
export function DavisAgenda() {
  const state = useSyncExternalStore(davisAgenda.subscribe, davisAgenda.getSnapshot)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && davisAgenda.getSnapshot().snapshot) void davisAgenda.refresh() }
    const timer = window.setInterval(refresh, 5 * 60_000)
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const [notice, setNotice] = useState('')
  const [connecting, setConnecting] = useState(false)
  const snapshot = state.snapshot
  const entries = snapshot?.entries ?? []
  const days = snapshot ? datesIn({ from: snapshot.from ?? snapshot.today, to: snapshot.to ?? shiftDate(snapshot.today, 6) }) : []
  const reminders = entries.filter((entry) => entry.kind === 'reminder')
  const hasEvents = days.some((day) => entries.some((entry) => entry.kind === 'event' && entry.startDate <= day && (entry.endDate || entry.startDate) >= day))
  const canConnect = davisSession.configured() && location.origin === new URL(DAVIS_CALLBACK_URL).origin
  async function connect() {
    setConnecting(true); setNotice(''); davisAgenda.disconnect()
    try { location.assign(await davisSession.begin()) }
    catch { setNotice('Davis connection could not be started. Your notes are unchanged.'); setConnecting(false) }
  }
  return <section className="davis-agenda" aria-labelledby="davis-title" data-state={state.status}>
    <div className="overview-section-head"><h2 id="davis-title"><Icon name="calendar" />Davis agenda</h2></div>
    {state.status !== 'ready' ? <p className="davis-status" role="status">{state.status === 'stale' && state.reason === 'refresh-failed' ? 'Davis could not be refreshed. These previously fetched items are stale.' : messages[state.status]}</p> : null}
    {snapshot ? <><p className="davis-source">{snapshot.householdName || 'Davis at Home'} · {snapshot.timezone}<br />Fetched {new Date(snapshot.fetchedAt).toLocaleString([], { timeZone: snapshot.timezone })}</p>
      {days.map((day) => {
        const events = entries.filter((entry) => entry.kind === 'event' && entry.startDate <= day && (entry.endDate || entry.startDate) >= day)
        return events.length ? <div className="davis-day" key={day}><h3>{day === snapshot.today ? 'Today' : day}</h3><ol className="davis-entries">{events.map((entry) => <li key={`${entry.sourceId}:${day}`}><span className="davis-date">{entry.time || 'No time recorded'}{entry.startDate !== (entry.endDate || entry.startDate) ? ` · ${entry.startDate} – ${entry.endDate}` : ''}</span>{entryLabel(entry)}</li>)}</ol></div> : null
      })}
      {reminders.length ? <div className="davis-reminders"><h3>Incomplete reminders</h3><ol className="davis-entries">{reminders.map((entry) => <li key={entry.sourceId}><span className="davis-date">{entry.startDate < snapshot.today ? 'Overdue reminder' : 'Reminder'} · {entry.startDate}</span>{entryLabel(entry)}</li>)}</ol></div> : null}
      {!hasEvents && !reminders.length && state.status === 'ready' ? <p className="desk-empty">No events or incomplete reminders in this fetched window.</p> : null}
      <div className="davis-actions"><button className="overview-back" onClick={() => void davisAgenda.refresh()}>Refresh</button><button className="overview-back" onClick={() => davisAgenda.disconnect()}>Disconnect Davis</button></div>
      <a className="davis-open" href={DAVIS_SOURCE_URL} target="_blank" rel="noopener noreferrer"><Icon name="source" />Open in Davis at Home</a>
    </> : canConnect ? <button className="overview-action" disabled={connecting} onClick={() => void connect()}>{connecting ? 'Starting connection…' : 'Connect Davis'}</button> : null}
    {notice ? <p role="status" className="davis-status">{notice}</p> : null}
    <details className="davis-connection-info"><summary>About this connection</summary><p>Read your approved household’s active events and incomplete reminders, including adult entries your account permits. Your account email is shared for sign-in. No edits or completion changes.</p><p>Tokens stay in this tab’s memory. Reconnect after closing or reloading the tab. Disconnect clears this view and its tokens; your consent remains until you revoke it in Davis.</p><a href={`${DAVIS_SOURCE_URL}/connect.html`} target="_blank" rel="noopener noreferrer">Manage consent in Davis</a></details>
  </section>
}
