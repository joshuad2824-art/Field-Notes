import { useState } from 'react'
import type { SienaItem } from '../lib/model'
import { needsResolution } from '../lib/siena-archive'
import { setSienaDisposition } from '../lib/siena-items'

export function SienaDisposition({ item, archived = false }: { item: SienaItem; archived?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function change(action: 'resolve' | 'reopen' | 'restore' | 'release') {
    setBusy(true); setError('')
    try { await setSienaDisposition(item.id, item.updated, action) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this change.') }
    finally { setBusy(false) }
  }
  return <div className="siena-disposition">
    {archived ? <button disabled={busy} onClick={() => void change('restore')}>{item.type === 'reminder' ? 'Reopen reminder' : 'Restore to active'}</button>
      : item.type !== 'reminder' ? <>
        {needsResolution(item) ? <button disabled={busy} onClick={() => void change('resolve')}>Resolve</button>
          : item.resolvedAt ? <button disabled={busy} onClick={() => void change('reopen')}>Reopen</button> : null}
        {item.retainedAt ? <button disabled={busy} onClick={() => void change('release')}>Release from active</button> : null}
        {item.resolvedAt ? <span>Resolved</span> : item.requiresAction === false ? <span>For reference</span> : <span>Open · kept until resolved</span>}
      </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
}
