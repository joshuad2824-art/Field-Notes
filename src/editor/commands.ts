import type { ChangeSpec, EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  INDENT_UNIT,
  MAX_INDENT,
  type MarkRun,
  type Placement,
  defaultSize,
  imageMarkdown,
  isTableLine,
  marksIn,
  readPlacement,
} from '../lib/model'

/* The bar writes markdown. Tapping Heading inserts "## "; the person who wants
   the fast path types the characters; the file on disk is identical either
   way. */

const BLOCK_RE = /^(#{1,3}\s+|>\s?|[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s)/

/* Where a line sits across the measure, when it is anywhere other than where
   every line sits by default. There is no markdown for this and no way to
   invent one that another editor would honour, so it is a brace tag — the
   same shape as `=={forest}` and a picture's `{left 44}`, and the same trade:
   readable, private, and one word at the front of the line anywhere else. */
export type Align = 'center' | 'right' | 'left'
export const ALIGN_RE = /^\{(center|right)\}/

/* A line is indent, then how it sits, then a block prefix, then the writing.
   Everything that reshapes a line has to read it in that order, or the first
   indented list item stops behaving like a list item at all. */
export function leadOf(text: string): string {
  return text.match(/^ */)?.[0] ?? ''
}

export function alignOf(text: string): string {
  return text.slice(leadOf(text).length).match(ALIGN_RE)?.[0] ?? ''
}

export function prefixOf(text: string): string {
  const at = leadOf(text).length + alignOf(text).length
  return text.slice(at).match(BLOCK_RE)?.[0] ?? ''
}

export function applyBlock(view: EditorView, prefix: string): boolean {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  const last = state.doc.lineAt(range.to).number
  const changes: ChangeSpec[] = []
  let n = 1

  for (let i = first; i <= last; i++) {
    const line = state.doc.line(i)
    const lead = leadOf(line.text) + alignOf(line.text)
    const existing = prefixOf(line.text)
    const same =
      existing === prefix ||
      (prefix === '1. ' && /^\d+\.\s$/.test(existing)) ||
      (prefix === '- [ ] ' && /^[-*]\s\[[ xX]\]\s$/.test(existing))
    const insert = same ? '' : prefix === '1. ' ? `${n++}. ` : prefix
    const at = line.from + lead.length
    changes.push({ from: at, to: at + existing.length, insert })
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

/* The highlights the selection has to do with, read with the grammar's own
   pattern so the tray and the page can never disagree about where one is.

   `inside` is the run the selection sits within, markers included — a caret at
   either edge of the word counts, because that is where a click lands, and it
   is the whole of what was wrong before: the old reading asked whether the
   selection's own edges sat exactly on the markers, which is true only in the
   moment just after the highlight was made. Everywhere else it fell through
   and started a second one inside the first.

   `across` is every run the selection touches, which is what a colour has to
   come off. */
function highlightsAt(state: EditorState, range: { from: number; to: number }) {
  const first = state.doc.lineAt(range.from)
  const last = state.doc.lineAt(range.to)
  const runs: MarkRun[] = []
  for (let i = first.number; i <= last.number; i++) {
    const line = state.doc.line(i)
    runs.push(...marksIn(line.text, line.from).filter((r) => r.kind.name === 'highlight'))
  }
  return {
    inside: runs.find((r) => range.from >= r.from && range.to <= r.to) ?? null,
    across: runs.filter((r) => range.from < r.to && range.to > r.from),
  }
}

/* The markers taken back out of a stretch of text, so a run can be laid over
   writing that was already lit without nesting one inside the other. */
const BARE = /==(?:\{\w+\})?([^=]+)==/g

export function applyHighlight(view: EditorView, color: string): boolean {
  const { state } = view
  const range = state.selection.main
  const { inside, across } = highlightsAt(state, range)

  /* Taking a colour off takes it off everything the selection touches, which
     is the only reading of "not highlighted any more" that can't leave some of
     it behind. */
  if (color === 'off') {
    if (!across.length) {
      view.focus()
      return false
    }
    const changes: ChangeSpec[] = across.flatMap((run) => [
      { from: run.from, to: run.body[0], insert: '' },
      { from: run.body[1], to: run.to, insert: '' },
    ])
    const probe = state.update({ changes })
    view.dispatch(
      state.update({
        changes,
        selection: {
          anchor: probe.changes.mapPos(range.from, 1),
          head: probe.changes.mapPos(range.to, -1),
        },
      }),
    )
    view.focus()
    return true
  }

  /* Standing inside one: change its colour rather than start another. The
     whole run changes, not the part under the selection — a run holds one
     colour, and splitting it to hold two would write `====` into the file for
     something nobody asked for. */
  if (inside) {
    const next = `=={${color}}`
    view.dispatch({
      changes: { from: inside.from, to: inside.body[0], insert: next },
      selection: {
        anchor: inside.from + next.length,
        head: inside.body[1] - inside.open.length + next.length,
      },
    })
    view.focus()
    return true
  }

  /* Nothing selected: take the word under the caret, the same as a mark. */
  const word = range.empty ? wordAt(state, range.head) : null
  if (range.empty && !word) {
    view.focus()
    return false
  }
  const wanted = word ?? range

  /* A highlight never spans a line break. The grammar reads one line at a
     time, so an opening `=={brass}` on one line and its `==` on the next can
     never be hidden — which is exactly how four characters of markdown end up
     showing on the page. A selection across three lines becomes three
     highlights, one per line, each closed where it started. */
  const opener = `=={${color}}`
  const first = state.doc.lineAt(wanted.from)
  const last = state.doc.lineAt(wanted.to)
  const changes: ChangeSpec[] = []

  for (let i = first.number; i <= last.number; i++) {
    const line = state.doc.line(i)
    let from = Math.max(wanted.from, line.from)
    let to = Math.min(wanted.to, line.to)
    /* Pull in off the whitespace at each end — a highlight around a trailing
       space reads as a smudge past the end of the word. */
    while (from < to && /\s/.test(state.sliceDoc(from, from + 1))) from++
    while (to > from && /\s/.test(state.sliceDoc(to - 1, to))) to--
    if (to <= from) continue

    /* A run the segment only half covers is swallowed whole, or taking its
       markers out would leave the other one of the pair stranded outside the
       selection with nothing to close. */
    for (const run of marksIn(line.text, line.from)) {
      if (run.kind.name !== 'highlight') continue
      if (from < run.to && to > run.from) {
        from = Math.min(from, run.from)
        to = Math.max(to, run.to)
      }
    }

    const text = state.sliceDoc(from, to).replace(BARE, '$1')
    /* `[^=]+` is what hides it, so a segment still carrying an `=` of its own
       can't be wrapped without showing the markers. */
    if (text.includes('=')) continue
    changes.push({ from, to, insert: opener + text + '==' })
  }

  if (!changes.length) {
    view.focus()
    return false
  }

  const probe = state.update({ changes })
  view.dispatch(
    state.update({
      changes,
      selection: word
        ? { anchor: probe.changes.mapPos(wanted.to, -1) }
        : {
            anchor: probe.changes.mapPos(wanted.from, 1),
            head: probe.changes.mapPos(wanted.to, -1),
          },
    }),
  )
  view.focus()
  return true
}

/* Where the line sits across the measure. Left is where every line sits
   already, so it is said by taking the tag off rather than by writing one —
   which is also what tapping the mark a second time does, since a mark that
   can only be put on is a mark that traps the line it was put on.

   Every line under the selection moves together, and a table's lines are left
   alone: a table is one block widget standing in for a run of them, and a tag
   in front of any of those lines would take it apart. */
export function applyAlign(view: EditorView, align: Align): boolean {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  const last = state.doc.lineAt(range.to).number

  const lines: { at: number; tag: string }[] = []
  for (let i = first; i <= last; i++) {
    const line = state.doc.line(i)
    if (isTableLine(line.text)) continue
    lines.push({ at: line.from + leadOf(line.text).length, tag: alignOf(line.text) })
  }
  if (!lines.length) {
    view.focus()
    return false
  }

  const wanted = align === 'left' ? '' : `{${align}}`
  const off = wanted !== '' && lines.every((line) => line.tag === wanted)
  const insert = off ? '' : wanted

  const changes: ChangeSpec[] = lines
    .filter((line) => line.tag !== insert)
    .map((line) => ({ from: line.at, to: line.at + line.tag.length, insert }))

  if (!changes.length) {
    view.focus()
    return false
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

/* Enter inside a list carries the list on, indent and all; Enter on an empty
   item steps it back out a level, and ends it once there's nowhere left to
   step back to. */
export function continueList(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false

  const line = state.doc.lineAt(range.head)
  /* The alignment travels with the item: pressing Enter in the middle of a
     centred list shouldn't drop the next bullet back to the margin. */
  const lead = leadOf(line.text) + alignOf(line.text)
  const prefix = prefixOf(line.text)
  if (!prefix || /^#{1,3}\s+$/.test(prefix)) return false
  if (range.head < line.from + lead.length + prefix.length) return false

  if (line.text.trimEnd() === (lead + prefix).trimEnd()) {
    /* An empty item that is indented gives up a level first — the way out of
       a nested list is the same key that got you into it. */
    if (lead.startsWith(INDENT_UNIT)) {
      const shorter = lead.slice(INDENT_UNIT.length)
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: shorter + prefix },
        selection: { anchor: line.from + shorter.length + prefix.length },
      })
      return true
    }
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    })
    return true
  }

  let next = prefix.replace(/\[[xX]\]/, '[ ]')
  const numbered = prefix.match(/^(\d+)\.\s$/)
  if (numbered) next = `${Number(numbered[1]) + 1}. `
  next = lead + next

  view.dispatch({
    changes: { from: range.head, to: range.to, insert: '\n' + next },
    selection: { anchor: range.head + 1 + next.length },
    scrollIntoView: true,
  })
  return true
}

/* Step the lines under the selection in or out one level. The indent is plain
   leading spaces, so this is nothing more exotic than adding or taking away
   two of them — but an ordered item has to be renumbered when it moves, or a
   list nested under another one carries its old number down with it. */
export function applyIndent(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  const last = state.doc.lineAt(range.to).number
  const changes: ChangeSpec[] = []

  /* The last ordered item we renumbered, so a block moving together stays in
     sequence with itself. */
  let numberedAt = -1
  let numberedDepth = -1
  let numberedValue = 0
  let touched = false

  for (let i = first; i <= last; i++) {
    const line = state.doc.line(i)
    if (!line.text.trim()) continue

    const lead = leadOf(line.text)
    const was = Math.floor(lead.length / INDENT_UNIT.length)
    const depth = Math.min(MAX_INDENT, Math.max(0, was + direction))
    if (depth !== was) touched = true

    const align = alignOf(line.text)
    const prefix = prefixOf(line.text)
    const numbered = /^\d+\.\s$/.test(prefix)
    let rest = line.text.slice(lead.length)

    if (numbered) {
      /* Carry on from the item above when there is one at this depth —
         whether we just renumbered it ourselves or it was already sitting
         there — and start again at one when there isn't. */
      let n = 1
      if (numberedAt === i - 1 && numberedDepth === depth) {
        n = numberedValue + 1
      } else if (i > 1) {
        const above = state.doc.line(i - 1)
        const aboveLead = leadOf(above.text)
        const aboveDepth = Math.floor(aboveLead.length / INDENT_UNIT.length)
        const aboveNumber = above.text
          .slice(aboveLead.length + alignOf(above.text).length)
          .match(/^(\d+)\.\s/)
        const aboveMoved = above.number >= first && above.number <= last
        if (!aboveMoved && aboveDepth === depth && aboveNumber) n = Number(aboveNumber[1]) + 1
      }
      numberedAt = i
      numberedDepth = depth
      numberedValue = n
      rest = align + `${n}. ` + rest.slice(align.length + prefix.length)
    }

    changes.push({
      from: line.from,
      to: line.from + line.text.length,
      insert: INDENT_UNIT.repeat(depth) + rest,
    })
  }

  if (!touched) {
    view.focus()
    return false
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

/* All caps is a change to the text, not a mark laid over it — there is no
   markdown for "shouted", and inventing one would be a private convention in
   a file meant to open anywhere. So the letters themselves change, and undo
   is what takes it back.

   It toggles: something already all caps comes back down, which is the only
   way back other than undo once the caret has moved on. */
export function applyCaps(view: EditorView): boolean {
  const { state } = view
  const selection = state.selection.main
  const expanded = selection.empty ? wordAt(state, selection.head) : null
  if (selection.empty && !expanded) {
    view.focus()
    return false
  }
  const range = expanded ?? selection

  const was = state.sliceDoc(range.from, range.to)
  if (!was.trim()) {
    view.focus()
    return false
  }
  const shouted = was === was.toUpperCase() && was !== was.toLowerCase()
  const next = shouted ? was.toLowerCase() : was.toUpperCase()
  if (next === was) {
    view.focus()
    return false
  }

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next },
    selection: expanded ? { anchor: range.to } : { anchor: range.from, head: range.to },
  })
  view.focus()
  return true
}
