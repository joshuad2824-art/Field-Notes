import { useState } from 'react'
import { useVault } from '../sync/vault'
import { useWidgetProjection } from './usePublisher'
import { connectWidget, publishWidget, revokeWidget, useWidgetConnection, widgetSetupCode } from './connection'

export function WidgetPanel() {
  const vault = useVault(), connection = useWidgetConnection()
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [showCode, setShowCode] = useState(false)
  const snapshot = useWidgetProjection(!!vault && (consent || !!connection))
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage('')
    try { await action(); setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update the widget connection.') }
    finally { setBusy(false) }
  }
  return <>
    <h2>Home Screen widgets</h2>
    <p>Calendar, weather and Quick Note can sit separately on your Home Screen in Scriptable.</p>
    <p>Weather and Quick Note need no calendar connection. The calendar connection shares only marked dates and source status. It never shares your writing, event details or archive key.</p>
    <p>Calendar marks update while Field Notes is open. Open it after changes or a long absence; the widget shows the snapshot time. Its read-only key expires after 90 days and can be revoked here.</p>
    {!vault ? <p>Pair this device in Sync before connecting calendar marks.</p> : <>
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /> Allow Scriptable to read calendar date markers. Connecting replaces any calendar widget connection made on another device.</label>
      <div className="actions">
        <button className="btn" disabled={!consent || busy || !snapshot} onClick={() => void run(async () => {
          if (snapshot) await connectWidget(snapshot)
          setShowCode(true)
        }, 'Calendar connected. Keep the setup code private.')}>{connection ? 'Reconnect calendar' : 'Connect calendar'}</button>
        {connection ? <>
          <button className="btn" disabled={busy || !snapshot} onClick={() => void run(() => publishWidget(snapshot!), 'Calendar snapshot updated.')}>Update widget</button>
          <button className="btn" disabled={busy} onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide setup code' : 'Show setup code'}</button>
          <button className="btn" disabled={busy} onClick={() => void run(async () => { await revokeWidget(); setShowCode(false); setConsent(false) }, 'Calendar widget access revoked.')}>Revoke calendar widget</button>
        </> : null}
      </div>
      {connection?.updated ? <p>Last snapshot: {new Date(connection.updated).toLocaleString()}</p> : null}
      {connection && showCode ? <label>Private Scriptable setup code
        <textarea aria-label="Private Scriptable setup code" readOnly value={widgetSetupCode()} onFocus={event => event.currentTarget.select()} style={{width:'100%', minHeight:100}} />
      </label> : null}
    </>}
    <p role="status">{message}</p>
  </>
}
