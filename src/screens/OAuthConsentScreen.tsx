import { useEffect, useState, type FormEvent } from 'react'
import { linkedVault, sendSignInLink, sienaClient } from '../siena/client'

interface Details {
  client: { name: string }
  redirect_uri: string
  scope: string
}

export function OAuthConsentScreen() {
  const authorizationId = new URLSearchParams(location.search).get('authorization_id')
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [linked, setLinked] = useState(false)
  const [details, setDetails] = useState<Details | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [check, setCheck] = useState(0)

  useEffect(() => {
    if (!authorizationId) return
    let live = true
    const load = async () => {
      try {
        const { data } = await sienaClient.auth.getUser()
        if (!live) return
        setSignedIn(!!data.user)
        if (!data.user) return
        const vault = await linkedVault()
        if (!live) return
        setLinked(!!vault)
        if (!vault) return
        const result = await sienaClient.auth.oauth.getAuthorizationDetails(authorizationId)
        if (result.error) throw result.error
        if (!live || !result.data) return
        if ('redirect_url' in result.data && !('authorization_id' in result.data)) {
          location.assign(result.data.redirect_url)
          return
        }
        setDetails(result.data as Details)
      } catch (error) {
        if (live) setNotice(error instanceof Error ? error.message : 'Could not load this request.')
      }
    }
    void load()
    const { data } = sienaClient.auth.onAuthStateChange(() => void load())
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [authorizationId, check])

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await sendSignInLink(email, location.href)
      setNotice('Check your email for the sign-in link, then return here.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send the link.')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (approve: boolean) => {
    if (!authorizationId) return
    setBusy(true)
    setNotice('')
    try {
      if (approve && !(await linkedVault())) throw new Error('Link your archive first.')
      const { data, error } = approve
        ? await sienaClient.auth.oauth.approveAuthorization(authorizationId)
        : await sienaClient.auth.oauth.denyAuthorization(authorizationId)
      if (error) throw error
      location.assign(data.redirect_url)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not complete this request.')
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="chrome"><span className="chrome-title">Connect Field Notes</span></header>
      <div className="scroll">
        <div className="panel-card">
          <h2>Siena access</h2>
          {!authorizationId ? <p>This connection request is missing its ID.</p> : null}
          {authorizationId && !signedIn ? (
            <>
              <p>Sign in to choose whether to connect your Field Notes archive.</p>
              <form className="actions" onSubmit={(event) => void signIn(event)}>
                <input className="well" type="email" required autoComplete="email"
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your email" aria-label="Email" />
                <button className="btn caps" type="submit" disabled={busy}>Email me a sign-in link</button>
              </form>
            </>
          ) : null}
          {signedIn && !linked ? (
            <>
              <p>Open Settings in Field Notes on a paired device, sign in with this email, and link your archive there. Then return to this request.</p>
              <button className="btn caps" onClick={() => setCheck((value) => value + 1)}>
                Check connection again
              </button>
            </>
          ) : null}
          {details && linked ? (
            <>
              <p><strong>{details.client.name}</strong> is asking to access your Field Notes archive.</p>
              <p className="meta">It can read notes and create or edit pages. It cannot delete pages.</p>
              <p className="meta">Requested permissions: {details.scope || 'Field Notes access'}</p>
              <p className="meta">Return to: {details.redirect_uri}</p>
              <div className="actions">
                <button className="btn caps" disabled={busy} onClick={() => void decide(true)}>Allow</button>
                <button className="btn caps" disabled={busy} onClick={() => void decide(false)}>Deny</button>
              </div>
            </>
          ) : null}
          {notice ? <p className="meta" role="status">{notice}</p> : null}
        </div>
      </div>
    </div>
  )
}
