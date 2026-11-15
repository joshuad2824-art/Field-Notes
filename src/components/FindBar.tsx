import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { closeFind, findState, setQuery, step } from '../editor/find'
import { Icon } from './Icon'

/* The find bar: one line under the page's tools while it is open. Enter goes
   to the next match, Shift+Enter to the one before, Escape closes and leaves
   the caret on the match that was showing. */
export function FindBar({ view, initial, onClose }: { view: EditorView; initial: string; onClose: () => void }) {
  const [query, setText] = useState(initial)
  const [, redraw] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
    if (initial) setQuery(view, initial)
    return () => {
      /* Closed by anything else — the page going, the menu taking over. */
      if (findState(view).query) closeFind(view, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state = findState(view)
  const count = state.matches.length
  const close = (select: boolean) => {
    closeFind(view, select)
    onClose()
  }
  const go = (by: 1 | -1) => {
    step(view, by)
    redraw((n) => n + 1)
  }

  return (
    <div className="find-bar" role="search" aria-label="Find in page">
      <Icon name="search" />
      <input
        ref={input}
        value={query}
        aria-label="Find in page"
        placeholder="Find in page"
        enterKeyHint="search"
        onChange={(e) => {
          setText(e.target.value)
          setQuery(view, e.target.value)
          redraw((n) => n + 1)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            go(e.shiftKey ? -1 : 1)
          }
          if (e.key === 'Escape') {
            /* Escape belongs to the bar while it is open: it must not also
               close the page or go up (dismiss.ts). */
            e.preventDefault()
            e.stopPropagation()
            close(true)
          }
        }}
      />
      <span className="find-count" aria-live="polite">
        {query.trim() ? (count ? `${state.current + 1} of ${count}` : 'None') : ''}
      </span>
      <button className="icon-control find-step" aria-label="Previous match" title="Previous — ⇧↩" disabled={!count} onClick={() => go(-1)}>
        <Icon name="back" />
      </button>
      <button className="icon-control find-step" aria-label="Next match" title="Next — ↩" disabled={!count} onClick={() => go(1)}>
        <Icon name="forward" />
      </button>
      <button className="icon-control" aria-label="Close find" title="Close — Esc" onClick={() => close(true)}>
        <Icon name="close" />
      </button>
    </div>
  )
}
