import { useState } from 'react'
import { consent, hasConsented, keyProblem, setModelKey, useModelKey } from '../writeup/key'

/* Settings → Journal. Small, because step one of the journal needs nothing
   configured at all: a week collects, offline, with no key and no account, and
   the entry that comes out is a real entry. Everything on this panel belongs to
   step two, which is an enhancement laid on top of that. */

export function JournalPanel() {
  const { key, consented } = useModelKey()
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const save = () => {
    const bad = keyProblem(draft)
    if (bad) return setProblem(bad)
    setProblem(null)
    setModelKey(draft)
    setDraft('')
  }

  return (
    <>
      <h2>Journal</h2>
      <p>
        Once a week the journal gathers everything written across every notebook into one
        entry, on the Sunday the week is named by. It is a page like any other page — the
        button is at the foot of the journal's own list, and collecting the same week twice
        updates the entry rather than making a second one.
      </p>
      <p>
        What is collected is the writing itself, day by day, with nothing thrown away. Rewriting
        it as prose is a second, separate step, and it needs a key.
      </p>

      <label className="panel-label" htmlFor="model-key">
        Model key
      </label>
      {/* Text, not `type="password"`. The suite asserts that no field anywhere
          in this app is an email or a password box, and that assertion is
          guarding a real promise rather than a cosmetic one — there is nothing
          to sign in to here, and a masked field is the shape of a login. It
          also stops a browser password manager offering to remember an API
          key. The pairing code, which carries the whole vault, is shown in the
          clear behind a button for the same reason. */}
      <input
        id="model-key"
        className="well"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={key ? 'A key is held on this device' : 'Paste an Anthropic API key'}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="actions">
        <button className="btn caps" disabled={!draft.trim()} onClick={save}>
          Hold it
        </button>
        {key ? (
          <button
            className="btn caps"
            onClick={() => {
              setModelKey('')
              setProblem(null)
            }}
          >
            Forget it
          </button>
        ) : null}
      </div>
      {problem ? <p className="panel-problem">{problem}</p> : null}

      {/* Said plainly, once, before the first send. This is the only thing in
          the app that puts page text anywhere other than this device and the
          user's own Supabase, and pretending otherwise would be the wrong kind
          of quiet. */}
      <p className="meta" style={{ marginTop: 16 }}>
        The key is held on this device only. It is never in the pairing code and never on the
        mirror, so each device is given it separately or goes without.
      </p>
      <div className="actions">
        <button
          className={`btn caps${consented ? ' on' : ''}`}
          onClick={() => consent(!hasConsented())}
        >
          {consented ? 'Agreed' : 'Agree'}
        </button>
      </div>
      <p className="meta" style={{ marginTop: 16 }}>
        Writing an entry up sends that entry — which is the whole of that week's writing — to
        Anthropic over the network. Nothing else in this app ever leaves the device except to
        your own mirror. Collecting a week does not send anything.
      </p>
    </>
  )
}
