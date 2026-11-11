import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { coverColor } from '../lib/theme'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { notebookOf, useNotebooks } from '../lib/notebooks'
import { QUICK_NOTES_BOOK, QUICK_NOTES_NOTEBOOK } from '../lib/model'
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
    quickBook = notebookOf(QUICK_NOTES_NOTEBOOK) ?? QUICK_NOTES_BOOK,
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
          {/* Closing files the note — in the chosen notebook, or in Quick
              Notes — so the mark is ✓, not ×. */}
          <button
            className="icon-control quick-note-done"
            aria-label="Done"
            title="Done"
            disabled={busy}
            onClick={() => void close()}
          >
            <Icon name="done" />
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
              {/* Where it will go, by name. Quick Notes unless another is
                  picked; tapping the picked one again goes back to Quick
                  Notes. Filing happens on ✓, through the same path as before. */}
              <div className="quick-note-books" role="radiogroup" aria-label="File quick note in">
                {[quickBook, ...books.filter((b) => b.id !== QUICK_NOTES_NOTEBOOK)].map((b) => {
                  const value = b.id === QUICK_NOTES_NOTEBOOK ? '' : b.id
                  return (
                    <label key={b.id} style={{ '--dot': coverColor(b.color) } as CSSProperties}>
                      <input
                        type="radio"
                        name="quick-note-notebook"
                        value={b.id}
                        checked={draft.notebook === value}
                        disabled={busy}
                        onChange={() => change({ ...draft, notebook: value })}
                        onClick={() => {
                          if (value && draft.notebook === value) change({ ...draft, notebook: '' })
                        }}
                      />
                      <i aria-hidden="true" />
                      <span>{b.name}</span>
                    </label>
                  )
                })}
              </div>
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
