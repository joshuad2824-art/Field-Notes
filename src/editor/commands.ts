import type { ChangeSpec, EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { type Placement, defaultSize, imageMarkdown, readPlacement } from '../lib/model'

/* The bar writes markdown. Tapping Heading inserts "## "; the person who wants
   the fast path types the characters; the file on disk is identical either
   way. */

const BLOCK_RE = /^(#{1,3}\s+|>\s?|[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s)/

export function applyBlock(view: EditorView, prefix: string): boolean {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  const last = state.doc.lineAt(range.to).number
  const changes: ChangeSpec[] = []
  let n = 1

  for (let i = first; i <= last; i++) {
    const line = state.doc.line(i)
    const existing = line.text.match(BLOCK_RE)?.[0] ?? ''
    const same =
      existing === prefix ||
      (prefix === '1. ' && /^\d+\.\s$/.test(existing)) ||
      (prefix === '- [ ] ' && /^[-*]\s\[[ xX]\]\s$/.test(existing))
    const insert = same ? '' : prefix === '1. ' ? `${n++}. ` : prefix
    changes.push({ from: line.from, to: line.from + existing.length, insert })
  }

  const probe = state.update({ changes })
  view.dispatch(
    state.update({
      changes,
      selection: {
        anchor: probe.changes.mapPos(range.anchor, 1),
        head: probe.changes.mapPos(range.head, 1),
      },
      scrollIntoView: true,
    }),
  )
  view.focus()
  return true
}

/* The word the caret is sitting in. Nothing is ever selected when a mark is
   tapped on a phone, so the mark has to find something to take hold of. */
const WORD = /[\w'’-]/

function wordAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const line = state.doc.lineAt(pos)
  const text = line.text
  let from = pos - line.from
  let to = from
  while (from > 0 && WORD.test(text[from - 1])) from--
  while (to < text.length && WORD.test(text[to])) to++
  if (to === from) return null
  return { from: line.from + from, to: line.from + to }
}

export function applyWrap(view: EditorView, open: string, close = open): boolean {
  const { state } = view
  const selection = state.selection.main

  /* With nothing selected, take the word under the caret. If there is no word
     there we do nothing at all rather than leave an empty pair of markers
     behind — those have no content to wrap, so the grammar can't hide them and
     the syntax would show. */
  const expanded = selection.empty ? wordAt(state, selection.head) : null
  if (selection.empty && !expanded) {
    view.focus()
    return false
  }
  const range = expanded ?? selection

  const before = state.sliceDoc(Math.max(0, range.from - open.length), range.from)
  const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + close.length))

  if (before === open && after === close) {
    view.dispatch({
      changes: [
        { from: range.from - open.length, to: range.from, insert: '' },
        { from: range.to, to: range.to + close.length, insert: '' },
      ],
      selection: expanded
        ? { anchor: range.to - open.length }
        : { anchor: range.from - open.length, head: range.to - open.length },
    })
    view.focus()
    return true
  }

  view.dispatch({
    changes: [
      { from: range.from, insert: open },
      { from: range.to, insert: close },
    ],
    /* A word we found ourselves leaves the caret after it, ready to carry on
       typing; a selection the person made stays selected. */
    selection: expanded
      ? { anchor: range.to + open.length }
      : { anchor: range.from + open.length, head: range.to + open.length },
  })
  view.focus()
  return true
}

export function applyHighlight(view: EditorView, color: string): boolean {
  const { state } = view
  const range = state.selection.main
  const head = state.sliceDoc(Math.max(0, range.from - 12), range.from)
  const open = head.match(/==(?:\{\w+\})?$/)?.[0]
  const closed = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + 2)) === '=='

  /* Already highlighted: swap the colour, or take it off. */
  if (open && closed) {
    const from = range.from - open.length
    if (color === 'off') {
      view.dispatch({
        changes: [
          { from, to: range.from, insert: '' },
          { from: range.to, to: range.to + 2, insert: '' },
        ],
        selection: { anchor: from, head: range.to - open.length },
      })
    } else {
      const next = `=={${color}}`
      view.dispatch({
        changes: { from, to: range.from, insert: next },
        selection: { anchor: from + next.length, head: range.to - open.length + next.length },
      })
    }
    view.focus()
    return true
  }

  if (color === 'off' || range.empty) {
    view.focus()
    return false
  }

  const next = `=={${color}}`
  view.dispatch({
    changes: [
      { from: range.from, insert: next },
      { from: range.to, insert: '==' },
    ],
    selection: { anchor: range.from + next.length, head: range.to + next.length },
  })
  view.focus()
  return true
}

/* Enter inside a list carries the list on; Enter on an empty item ends it. */
export function continueList(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false

  const line = state.doc.lineAt(range.head)
  const prefix = line.text.match(BLOCK_RE)?.[0]
  if (!prefix || /^#{1,3}\s+$/.test(prefix)) return false
  if (range.head < line.from + prefix.length) return false

  if (line.text.trimEnd() === prefix.trimEnd()) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    })
    return true
  }

  let next = prefix.replace(/\[[xX]\]/, '[ ]')
  const numbered = prefix.match(/^(\d+)\.\s$/)
  if (numbered) next = `${Number(numbered[1]) + 1}. `

  view.dispatch({
    changes: { from: range.head, to: range.to, insert: '\n' + next },
    selection: { anchor: range.head + 1 + next.length },
    scrollIntoView: true,
  })
  return true
}

/* A picture goes in on its own line, so the float has somewhere to start and
   the writing that follows runs around it. */
export function insertPicture(view: EditorView, markdown: string): boolean {
  const { state } = view
  const range = state.selection.main
  const line = state.doc.lineAt(range.from)
  const atLineStart = line.text.trim() === ''
  const insert = atLineStart ? `${markdown}\n` : `\n${markdown}\n`
  const at = atLineStart ? line.from : line.to

  view.dispatch({
    changes: { from: at, to: atLineStart ? line.to : at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}

/* Move a picture to wherever it was dropped. The page is a markdown string, so
   "anywhere" means anywhere in the writing — the node lifts out of the line it
   was on and lands as its own line where the cursor would have gone. */
export function movePicture(view: EditorView, from: number, to: number, at: number): boolean {
  const { state } = view
  if (from < 0 || to > state.doc.length || from >= to) return false

  const markdown = state.sliceDoc(from, to)
  const source = state.doc.lineAt(from)
  const target = state.doc.lineAt(at)
  if (target.number === source.number) return false

  /* If the picture had a line to itself, take the line; otherwise just the
     node, so surrounding prose closes up. */
  const alone = source.text.trim() === markdown.trim()
  const cutFrom = alone ? source.from : from
  const cutTo = alone ? Math.min(state.doc.length, source.to + 1) : to

  const landing = target.from
  if (landing > cutFrom && landing < cutTo) return false

  const changes = [
    { from: cutFrom, to: cutTo, insert: '' },
    { from: landing, to: landing, insert: `${markdown}\n` },
  ].sort((a, b) => a.from - b.from)

  view.dispatch({ changes, scrollIntoView: true })
  return true
}

/* Change how a picture sits without disturbing anything around it. */
const NODE_RE =
  /^!\[([^\]]*)\]\(images\/([\w-]+)\.(\w+)\)(?:\{(left|right|margin|full)(?:\s+(\d{1,3}))?\})?$/

export function repicture(
  view: EditorView,
  from: number,
  to: number,
  patch: { placement?: Placement; size?: number },
): boolean {
  const source = view.state.sliceDoc(from, to)
  const parts = source.match(NODE_RE)
  if (!parts) return false

  const was = readPlacement(parts[4])
  const placement = patch.placement ?? was
  const size = patch.size ?? (parts[5] ? Number(parts[5]) : defaultSize(was))

  const next = imageMarkdown(parts[2], parts[3], parts[1], placement, size)
  if (next === source) return false

  view.dispatch({ changes: { from, to, insert: next } })
  return true
}

export function pictureSizeAt(view: EditorView, from: number, to: number): number {
  const parts = view.state.sliceDoc(from, to).match(NODE_RE)
  if (!parts) return 44
  return parts[5] ? Number(parts[5]) : defaultSize(readPlacement(parts[4]))
}
