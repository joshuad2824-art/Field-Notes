import { useEffect, useState } from 'react'
import { completeDavisCallback } from '../davis/oauth'
import { navigate, to } from '../lib/router'

export function DavisCallbackScreen() {
  const [notice, setNotice] = useState('Confirming read-only Davis agenda access…')
  useEffect(() => {
    let active = true
    void completeDavisCallback().then(() => { if (active) navigate(to.overview(), { replace: true }) }).catch(() => { if (active) setNotice('Davis could not confirm this connection. Return to your desk and reconnect when setup is ready.') })
    return () => { active = false }
  }, [])
  return <div className="app"><div className="statusband" /><main className="review-screen scroll"><div className="review-wrap"><h1>Connect Davis</h1><p role="status">{notice}</p><p>Calendar access is read only. This connection shares your account email for sign-in. Tokens last only in this tab; reconnect after closing or reloading it. Local disconnect clears this view, while consent remains until revoked in Davis.</p><button className="overview-action" onClick={() => navigate(to.overview(), { replace: true })}>Return to desk</button></div></main></div>
}
