import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { findRanges, type FindRange } from './find-ranges.ts'

/* Find in page (November 2026). The browser's own ⌘F can't do it here:
   CodeMirror only draws the lines near the screen, so on a long page most of
   the writing isn't in the document for the browser to look through. This
   searches the page's text itself, marks every match, and steps between them.

   The marks are backgrounds only — a mark decoration adds no height — so the
   28px grid is untouched while they show. */

export interface FindState {
  query: string
  matches: FindRange[]
  current: number
}

export const setFind = StateEffect.define<{ query: string; current?: number }>()
export const stepFind = StateEffect.define<number>()

const empty: FindState = { query: '', matches: [], current: -1 }

const match = Decoration.mark({ class: 'cm-find-match' })
const current = Decoration.mark({ class: 'cm-find-match cm-find-current' })

export const findField = StateField.define<FindState>({
  create: () => empty,
  update(state, tr) {
    let next = state
    if (tr.docChanged && state.query) {
      const matches = findRanges(tr.state.doc.toString(), state.query)
      next = { ...state, matches, current: Math.min(state.current, matches.length - 1) }
    }
    for (const effect of tr.effects) {
      if (effect.is(setFind)) {
        const query = effect.value.query
        const matches = query ? findRanges(tr.state.doc.toString(), query) : []
        const head = tr.state.selection.main.from
        const first = matches.findIndex((m) => m.from >= head)
        next = {
          query,
          matches,
          current: matches.length ? (effect.value.current ?? (first < 0 ? 0 : first)) : -1,
        }
      }
      if (effect.is(stepFind) && next.matches.length) {
        const count = next.matches.length
        next = { ...next, current: (((next.current + effect.value) % count) + count) % count }
      }
    }
    return next
  },
  provide: (field) =>
    EditorView.decorations.from(field, (state): DecorationSet =>
      Decoration.set(
        state.matches.map((m, i) => (i === state.current ? current : match).range(m.from, m.to)),
      ),
    ),
})

export function find(): Extension {
  return findField
}

export function findState(view: EditorView): FindState {
  return view.state.field(findField, false) ?? empty
}

/* Brings the current match into view, in the middle of the screen, without
   taking the caret out of the find field. */
function reveal(view: EditorView) {
  const state = findState(view)
  const at = state.matches[state.current]
  if (at) view.dispatch({ effects: EditorView.scrollIntoView(at.from, { y: 'center' }) })
}

export function setQuery(view: EditorView, query: string) {
  view.dispatch({ effects: setFind.of({ query }) })
  reveal(view)
}

export function step(view: EditorView, by: 1 | -1) {
  view.dispatch({ effects: stepFind.of(by) })
  reveal(view)
}

/* Closing leaves the caret on the match that was showing, so the writing can
   carry on from where the search arrived. */
export function closeFind(view: EditorView, select: boolean) {
  const state = findState(view)
  const at = state.matches[state.current]
  view.dispatch({
    effects: setFind.of({ query: '' }),
    ...(select && at ? { selection: { anchor: at.from, head: at.to } } : {}),
  })
  if (select) view.focus()
}
