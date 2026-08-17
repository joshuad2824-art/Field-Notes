import { useState } from 'react'
import { shortStamp } from '../lib/format'
import { connect, disconnect, syncNow } from '../sync/engine'
import { decodeCode, encodeCode, looksLikeProjectUrl, normaliseUrl } from '../sync/pairing'
import { useSyncStatus } from '../sync/status'
import { createVault, useVault } from '../sync/vault'

/* Settings → Sync. The only screen in the app that has anything to say about a
   network, and it is deliberately a back room: the writing surface never
   mentions any of this, and every failure here leaves the pages exactly where
   they were.

   There is no account, no email and no password anywhere below. The first
   device makes a key; every other device is handed it once. That is the whole
   ceremony, and it never happens twice on the same device. */

type Mode = 'first' | 'join'

export function SyncPanel() {
  const vault = useVault()
  const status = useSyncStatus()

  const [mode, setMode] = useState<Mode>('first')
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)

  const first = async () => {
    setProblem(null)
    if (!looksLikeProjectUrl(url)) {
      setProblem('That does not look like a project URL. It ends in .supabase.co.')
      return
    }
    if (anonKey.trim().length < 20) {
      setProblem('That anon key looks too short to be one.')
      return
    }
    setBusy(true)
    try {
      await connect(await createVault(normaliseUrl(url), anonKey.trim()), false)
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    setProblem(null)
    setBusy(true)
    try {
      await connect(await decodeCode(code), true)
      setCode('')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  /* ── paired ──────────────────────────────────────────────────────────── */

  if (vault) {
    const pairing = encodeCode(vault)
    return (
      <>
        <h2>Sync</h2>
        <p>
          This device is paired. Writing goes to the device first and reaches the others
          afterwards, on its own; nothing here is ever waited on. There is no session behind it
          and nothing to sign in to again.
        </p>

        <p className="meta" style={{ marginTop: 16 }}>
          {label(status.state)}
          {status.lastSyncedAt ? ` · last ${shortStamp(status.lastSyncedAt)}` : ''}
        </p>
        {status.error ? <p className="sync-problem">{status.error}</p> : null}

        <div className="actions">
          <button
            className="btn caps"
            disabled={status.state === 'syncing'}
            onClick={() => void syncNow()}
          >
            Sync now
          </button>
          <button className="btn caps" onClick={() => setShowCode(!showCode)}>
            {showCode ? 'Hide the code' : 'Pair another device'}
          </button>
          <button className="btn caps danger" onClick={() => setConfirmOff(true)}>
            Unpair
          </button>
        </div>

        {showCode ? (
          <>
            <p style={{ marginTop: 20 }}>
              Paste this into Settings → Sync on the other device, under “already has it”. It
              carries the vault key, so treat it like the key to the archive — anyone holding it
              can read and write everything in it.
            </p>
            <p className="meta mono-block sync-code">{pairing}</p>
            <div className="actions">
              <button
                className="btn caps"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pairing)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    setProblem('The clipboard was refused. Select the code and copy it.')
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        ) : null}

        {confirmOff ? (
          <div className="manager-confirm" style={{ marginTop: 20 }}>
            <div className="confirm-title">Unpair this device?</div>
            <div className="confirm-line">
              Every page stays here. It stops reaching the others, and the vault is untouched —
              pairing again with the same code picks it back up.
            </div>
            <div className="confirm-buttons">
              <button
                className="outline danger"
                onClick={async () => {
                  await disconnect()
                  setConfirmOff(false)
                  setShowCode(false)
                }}
              >
                Unpair it
              </button>
              <button className="outline" onClick={() => setConfirmOff(false)}>
                Keep it paired
              </button>
            </div>
          </div>
        ) : null}
        {problem ? <p className="sync-problem">{problem}</p> : null}
      </>
    )
  }

  /* ── not paired ──────────────────────────────────────────────────────── */

  return (
    <>
      <h2>Sync</h2>
      <p>
        Not set up. Everything works exactly as it does now; the pages simply stay on this
        device. Setting it up is one paste per device and then never again — there is no account
        and nothing that expires.
      </p>

      <div className="actions">
        <button
          className={`btn caps${mode === 'first' ? ' on' : ''}`}
          onClick={() => setMode('first')}
        >
          First device
        </button>
        <button
          className={`btn caps${mode === 'join' ? ' on' : ''}`}
          onClick={() => setMode('join')}
        >
          Already has it
        </button>
      </div>

      {mode === 'first' ? (
        <div className="sync-form">
          <p>
            Make a free Supabase project, run <code>supabase/schema.sql</code> from this repo in
            its SQL editor, then paste the project URL and the anon key below. Both are on the
            project’s API settings page and neither is a secret — the vault key this device
            generates is, and it never leaves here except in a pairing code you carry yourself.
          </p>
          <label className="sync-label" htmlFor="sync-url">
            Project URL
          </label>
          <input
            id="sync-url"
            className="well"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxx.supabase.co"
            autoComplete="off"
            spellCheck={false}
          />
          <label className="sync-label" htmlFor="sync-anon">
            Anon key
          </label>
          <input
            id="sync-anon"
            className="well"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOi…"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="actions">
            <button className="btn caps" disabled={busy} onClick={() => void first()}>
              {busy ? 'Connecting' : 'Make the vault'}
            </button>
          </div>
        </div>
      ) : (
        <div className="sync-form">
          <p>
            On a device that is already paired, open Settings → Sync → Pair another device and
            copy the code. Paste it here. This device’s untouched first page is dropped rather
            than added to the vault; anything written on it is kept and sent across.
          </p>
          <label className="sync-label" htmlFor="sync-code">
            Pairing code
          </label>
          <textarea
            id="sync-code"
            className="well sync-paste"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="fn1.…"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="actions">
            <button
              className="btn caps"
              disabled={busy || !code.trim()}
              onClick={() => void join()}
            >
              {busy ? 'Pairing' : 'Pair this device'}
            </button>
          </div>
        </div>
      )}

      {problem ? <p className="sync-problem">{problem}</p> : null}
    </>
  )
}

function label(state: string): string {
  switch (state) {
    case 'syncing':
      return 'syncing'
    case 'offline':
      return 'offline — it will catch up'
    case 'error':
      return 'not getting through'
    default:
      return 'paired'
  }
}
