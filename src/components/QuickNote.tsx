import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { useNotebooks } from '../lib/notebooks'
import {
  readQuickNote,
  saveQuickNote,
  closeQuickNote,
  type QuickDraft,
} from '../lib/quick-note'
export function QuickNote({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<QuickDraft | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const books = useNotebooks(),
    pending = useRef(Promise.resolve()),
    closing = useRef(false),
    input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    let active = true
    void readQuickNote()
      .then((d) => {
        if (active) setDraft(d)
      })
      .catch((e) => setError(String(e)))
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (draft) input.current?.focus()
  }, [Boolean(draft)])
  function change(next: QuickDraft) {
    setDraft(next)
    pending.current = pending.current.catch(() => {}).then(() => saveQuickNote(next))
    void pending.current.catch(() =>
      setError('Your draft could not be saved. Keep this window open and try again.'),
    )
  }
  async function close() {
    if (closing.current) return
    if (!draft) {
      onClose()
      return
    }
    closing.current = true
    setBusy(true)
    setError('')
    try {
      await pending.current.catch(() => {})
      await closeQuickNote(draft)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this note.')
      closing.current = false
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={() => void close()}>
      <section className="quick-note-dialog" aria-labelledby="quick-note-title">
        <header>
          <h2 id="quick-note-title">Quick note</h2>
          <button
            className="icon-control"
            aria-label="Close quick note"
            disabled={busy}
            onClick={() => void close()}
          >
            <Icon name="close" />
          </button>
        </header>
        {draft ? (
          <>
            <textarea
              ref={input}
              aria-label="Quick note"
              placeholder="A thought to keep…"
              value={draft.body}
              disabled={busy}
              onChange={(e) => change({ ...draft, body: e.target.value })}
            />
            <footer>
              <label>
                File in
                <select
                  aria-label="File quick note in"
                  value={draft.notebook}
                  disabled={busy}
                  onChange={(e) => change({ ...draft, notebook: e.target.value })}
                >
                  <option value="">Keep as a quick note</option>
                  {books.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {draft.notebook
                  ? 'Filed into this notebook when you close.'
                  : 'Kept on this device until you choose a notebook.'}
              </p>
            </footer>
          </>
        ) : (
          <p>Opening your note…</p>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </Sheet>
  )
}
