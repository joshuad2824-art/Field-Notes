import { navigate, to } from '../lib/router'
import { statusLabel, useSyncStatus } from '../sync/status'

/* The whole of what sync is allowed to say for itself: one word, in the same
   quiet register as Trash and Settings, under the rule from the architecture
   note — a small indicator, never a modal, never a blocker. It says nothing at
   all when sync was never set up.

   The one time it becomes a button is the one time it is actionable. Offline
   passes on its own and is not worth a tap; a refused key does not. */
export function SyncMark() {
  const status = useSyncStatus()
  const label = statusLabel(status)
  if (!label) return null

  if (status.state === 'error') {
    return (
      <button
        className="sync-mark bad"
        onClick={() => navigate(to.settings())}
        title={status.error ?? undefined}
      >
        {label}
      </button>
    )
  }

  return <span className={`sync-mark${status.state === 'offline' ? ' dim' : ''}`}>{label}</span>
}
