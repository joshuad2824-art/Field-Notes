import { useState } from 'react'
import { appleCalendar, useAppleCalendar, type AppleStatus } from '../apple/calendar'
import { Icon } from './Icon'

const messages: Partial<Record<AppleStatus, string>> = {
  setup: 'Pair this device under Sync to show your Apple Calendar here.',
  loading: 'Loading your Apple Calendar…',
  unavailable: 'The calendar feed isn’t connected on the server yet. Nothing is wrong with your calendar.',
  denied: 'The server didn’t accept this device’s sync key. Check Sync in Settings.',
  error: 'Your Apple Calendar could not be refreshed. This does not mean it is empty.',
  offline: 'You’re offline. Any events shown are from the last time it loaded.',
  stale: 'These events are from the last time it loaded. Refresh to check for changes.',
}

export function AppleCalendar() {
  const state = useAppleCalendar()
  const [busy, setBusy] = useState(false)
  const snapshot = state.snapshot
  async function refresh() {
    setBusy(true)
    try {
      await appleCalendar.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="davis-agenda apple-calendar" aria-labelledby="apple-title" data-state={state.status}>
      <div className="overview-section-head">
        <h2 id="apple-title">
          <Icon name="calendar" />
          Apple Calendar
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
          iCloud didn’t answer just now, so these are the last events it sent.
        </p>
      ) : null}
      {snapshot ? (
        <>
          <p className="davis-source">
            {snapshot.calendarName || 'Apple Calendar'} · {snapshot.timezone}
            <br />
            Fetched {new Date(snapshot.fetchedAt).toLocaleString()}
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
              There are more events in this stretch than can be shown at once.
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
            aria-label="Refresh Apple Calendar"
            title="Refresh"
          >
            <Icon name="refresh" />
          </button>
        </div>
      ) : null}
      <details className="davis-connection-info">
        <summary>About this connection</summary>
        <p>
          Your published Apple Calendar is read through your own Supabase project, one way. Nothing
          is written back to Apple Calendar, and its events never become notes.
        </p>
        <p>
          The feed’s address stays on the server as a secret. It isn’t in this app or its code, and
          it never reaches this device. To stop sharing, unpublish the calendar in Apple Calendar.
        </p>
      </details>
    </section>
  )
}
