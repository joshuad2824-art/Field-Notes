import type { EditorView } from '@codemirror/view'

/* A line where the picture will land if you let go now. Drawn straight into
   the scroller rather than through the document, because it isn't part of the
   writing — it's a hint that disappears the moment you release. */

const MARKER = 'cm-drop-marker'

function marker(view: EditorView): HTMLElement {
  const existing = view.scrollDOM.querySelector<HTMLElement>(`.${MARKER}`)
  if (existing) return existing
  const el = document.createElement('div')
  el.className = MARKER
  el.setAttribute('aria-hidden', 'true')
  view.scrollDOM.appendChild(el)
  return el
}

export function showDropMarker(view: EditorView, pos: number): void {
  const coords = view.coordsAtPos(pos)
  if (!coords) return hideDropMarker(view)

  const scroller = view.scrollDOM.getBoundingClientRect()
  const content = view.contentDOM.getBoundingClientRect()
  const el = marker(view)

  el.style.top = `${coords.top - scroller.top + view.scrollDOM.scrollTop - 1}px`
  el.style.left = `${content.left - scroller.left}px`
  el.style.width = `${content.width}px`
  el.classList.add('on')
}

export function hideDropMarker(view: EditorView): void {
  view.scrollDOM.querySelector(`.${MARKER}`)?.classList.remove('on')
}
