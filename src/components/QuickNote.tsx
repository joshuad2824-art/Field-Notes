import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { coverColor } from '../lib/theme'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { useNotebooks } from '../lib/notebooks'
import { navigate } from '../lib/router'
import { NATIVE_WIDGET_ROUTE_EVENT, nativeWidgetRoute, type NativeWidgetNavigation } from '../lib/native-widget-route'
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
    input = useRef<HTMLTextAreaElement>(null),
    currentDraft = useRef<QuickDraft | null>(null)
  useEffect(() => {
    let active = true
    void readQuickNote()
      .then((d) => {
        if (active) { currentDraft.current = d; setDraft(d) }
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
    currentDraft.current = next
    setDraft(next)
    pending.current = pending.current.catch(() => {}).then(() => saveQuickNote(next))
    void pending.current.catch(() =>
      setError('Your draft could not be saved. Keep this window open and try again.'),
    )
  }
  async function close(): Promise<boolean> {
    if (closing.current) return false
    const latest = currentDraft.current
    if (!latest) {
      onClose()
      return true
    }
    closing.current = true
    setBusy(true)
    setError('')
    try {
      await pending.current.catch(() => {})
      await closeQuickNote(latest)
      onClose()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this note.')
      closing.current = false
      setBusy(false)
      return false
    }
  }
  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<NativeWidgetNavigation>).detail
      if (!request || typeof request.path !== 'string' || nativeWidgetRoute('fieldnotes://' + request.path.slice(1)) !== request.path) return
      event.preventDefault()
      if (request.path === '/quick-note') { input.current?.focus(); return }
      void close().then(saved => { if (saved) navigate(request.path, { replace: request.replace }) })
    }
    window.addEventListener(NATIVE_WIDGET_ROUTE_EVENT, open)
    return () => window.removeEventListener(NATIVE_WIDGET_ROUTE_EVENT, open)
  }, [onClose])
  return (
    <Sheet onClose={() => void close()}>
      <section className="quick-note-dialog" aria-labelledby="quick-note-title">
        <header>
          <h2 id="quick-note-title">Quick note</h2>
          {/* Closing files the note when a notebook is chosen and keeps it
              as a quick note when not — so the mark is ✓, not ×. */}
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
              {/* A dot per notebook. None chosen and it stays a quick note;
                  tapping the chosen dot again takes the choice back. Filing
                  still happens on close, through the same path as before. */}
              <div className="quick-note-books" role="radiogroup" aria-label="File quick note in">
                {books.map((b) => (
                  <label key={b.id} title={b.name} style={{ '--dot': coverColor(b.color) } as CSSProperties}>
                    <input
                      type="radio"
                      name="quick-note-notebook"
                      value={b.id}
                      aria-label={b.name}
                      checked={draft.notebook === b.id}
                      disabled={busy}
                      onChange={() => change({ ...draft, notebook: b.id })}
                      onClick={() => {
                        if (draft.notebook === b.id) change({ ...draft, notebook: '' })
                      }}
                    />
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
              {/* The chosen notebook says its name; nothing is chosen, nothing
                  is said. */}
              <span className="quick-note-book" aria-hidden="true">
                {books.find((b) => b.id === draft.notebook)?.name ?? ''}
              </span>
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
