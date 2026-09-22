import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { linkedVault, sendSignInLink, sienaClient, SIENA_PUBLISHABLE_KEY, SIENA_URL } from '../siena/client'
import { useVault } from '../sync/vault'

export function SienaConnectPanel() {
  const vault = useVault()
  const [user, setUser] = useState<User | null>(null)
  const [linked, setLinked] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let live = true
    const refresh = async () => {
      const { data } = await sienaClient.auth.getUser()
      if (!live) return
      setUser(data.user)
      if (data.user) {
        try {
          setLinked(await linkedVault())
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Could not check the connection.')
        }
      } else setLinked(null)
    }
    void refresh()
    const { data } = sienaClient.auth.onAuthStateChange(() => void refresh())
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await sendSignInLink(email, `${location.origin}/settings`)
      setNotice('Check your email for a sign-in link, then return here.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send the link.')
    } finally {
      setBusy(false)
    }
  }

  const pair = async () => {
    if (!vault) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await sienaClient.auth.getSession()
      if (error || !data.session) throw error ?? new Error('Sign in first.')
      const response = await fetch(`${SIENA_URL}/rest/v1/vault_links`, {
        method: 'POST',
        headers: {
          apikey: SIENA_PUBLISHABLE_KEY,
          Authorization: `Bearer ${data.session.access_token}`,
          'x-vault-key': vault.key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: data.session.user.id, vault: vault.id }),
      })
      if (!response.ok) throw new Error('Could not link this archive. Try again from a paired device.')
      setLinked(vault.id)
      setNotice('Connected. Your notes are ready for the Siena plugin.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not link this archive.')
    } finally {
      setBusy(false)
    }
  }

  const unpair = async () => {
    setBusy(true)
    setNotice('')
    try {
      const { error } = await sienaClient.from('vault_links').delete().eq('vault', linked)
      if (error) throw error
      setLinked(null)
      setNotice('Siena access has been removed.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="siena-connect">
      <h2>Siena</h2>
      <p>Connect this archive so Siena can find and write notes when you talk on any device.</p>
      {!vault ? <p className="meta">Set up Sync on this device first.</p> : null}
      {vault && !user ? (
        <form className="actions" onSubmit={(event) => void signIn(event)}>
          <input
            className="well"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Your email"
            aria-label="Email for Siena connection"
          />
          <button className="btn caps" disabled={busy} type="submit">Email me a sign-in link</button>
        </form>
      ) : vault && user ? (
        <>
          <p className="meta">Signed in as {user.email}</p>
          {linked === vault?.id ? (
            <div className="actions">
              <span className="meta">Archive linked</span>
              <button className="btn caps" disabled={busy} onClick={() => void unpair()}>
                Remove Siena access
              </button>
            </div>
          ) : linked ? (
            <>
              <p className="meta">This account is linked to another archive.</p>
              <button className="btn caps" disabled={busy} onClick={() => void unpair()}>
                Remove that link
              </button>
            </>
          ) : (
            <button className="btn caps" disabled={!vault || busy} onClick={() => void pair()}>
              Link this archive
            </button>
          )}
        </>
      ) : null}
      {notice ? <p className="meta" role="status">{notice}</p> : null}
    </section>
  )
}
