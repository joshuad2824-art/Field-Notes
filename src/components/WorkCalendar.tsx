import { useState } from 'react'
import { workCalendar, useWorkCalendar, type WorkStatus } from '../work-calendar/calendar'
import { Icon } from './Icon'

const messages: Partial<Record<WorkStatus, string>> = {
  setup: 'Pair this device under Sync to show your Work Calendar here.',
  loading: 'Loading your Work Calendar…',
  unavailable: 'The first scheduled work-calendar update has not arrived yet.',
  denied: 'The server didn’t accept this device’s sync key. Check Sync in Settings.',
  error: 'Your Work Calendar could not be refreshed. This does not mean it is empty.',
  offline: 'You’re offline. Any events shown are from the last time it loaded.',
  stale: 'These events are from the last time it loaded. Refresh to check for changes.',
}

export function WorkCalendar() {
  const state = useWorkCalendar()
  const [busy, setBusy] = useState(false)
  const snapshot = state.snapshot
  async function refresh() {
    setBusy(true)
    try {
      await workCalendar.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="davis-agenda work-calendar" aria-labelledby="work-title" data-state={state.status}>
      <div className="overview-section-head">
        <h2 id="work-title">
          <Icon name="calendar" />
          Work Calendar
        </h2>
        <span className="section-label">Read only</span>
      </div>
      {state.status !== 'ready' ? (
        <p className="davis-status" role="status">
          {messages[state.status]}
        </p>
      ) : null}
      {snapshot?.stale && state.status === 'ready' ? (
        <p className="davis-status" role="status">
          The scheduled update is overdue. These are the last verified work events.
        </p>
      ) : null}
      {snapshot ? (
        <>
          <p className="davis-source">
            {snapshot.calendarName || 'Work Calendar'} · {snapshot.timezone}
            <br />
            Updated {new Date(snapshot.fetchedAt).toLocaleString()} · Coverage {snapshot.from} – {snapshot.to}
          </p>
          {snapshot.skipped ? (
            <p className="davis-status" role="status">
              {snapshot.skipped === 1
                ? 'One repeating event uses a rule that can’t be expanded here, so only its first date is shown.'
                : `${snapshot.skipped} repeating events use rules that can’t be expanded here, so only their first dates are shown.`}
            </p>
          ) : null}
          {snapshot.truncated ? (
            <p className="davis-status" role="status">
              This view extends beyond the dates covered by the latest scheduled update.
            </p>
          ) : null}
        </>
      ) : null}
      {state.status !== 'setup' ? (
        <div className="davis-actions">
          <button
            className="overview-back"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label="Refresh Work Calendar"
            title="Refresh"
          >
            <Icon name="refresh" />
          </button>
        </div>
      ) : null}
      <details className="davis-connection-info">
        <summary>About this connection</summary>
        <p>Your primary Ascension calendar is refreshed by Siena at 7 a.m., 10 a.m., noon, 2 p.m. and 5 p.m. Central each day while Codex can run. Refresh here retrieves the last saved update; it does not query Google.</p>
        <p>Titles and scheduled times only. Changes and cancellations replace the prior snapshot after a complete successful review. Google remains the source; no invitations or calendar edits are sent.</p>
      </details>
    </section>
  )
}
