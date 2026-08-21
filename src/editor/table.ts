import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { Text } from '@codemirror/state'
import {
  type Cell,
  FULL_WIDTH,
  MIN_TABLE_WIDTH,
  type Table,
  addColumn,
  addRow,
  clampWidth,
  columnOf,
  emptyTable,
  isDelimiterRow,
  isTableAttr,
  isTableRow,
  mergeAt,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
  setTableWidth,
  setWidths,
  splitAt,
} from '../lib/table'

/* A table is the one thing on the page that can't be decorated text.

   Column widths, per-row merges and a cell that wraps are all things a row of
   independent lines cannot do — the moment a cell runs to two lines, the
   cells beside it have no way to know. So the whole table is replaced by one
   atomic block widget drawing a real <table>, and every edit inside it is
   dispatched back into the document as markdown. CodeMirror's history then
   owns undo, the same as it does for typing.

   `ignoreEvent` returns true for the same reason the picture plate's does:
   letting CodeMirror see mousedown in here makes it start a text selection
   instead, and the cells stop being editable at all. */

const MIN_WIDTH = 6
/* Every row is a whole number of 28px lines, so the dot grid never drifts out
   from under a table the way it would under an arbitrary border. */
export const ROW_PITCH = 28

export interface TableRun {
  from: number
  to: number
  firstLine: number
  lastLine: number
  text: string
}

/* A run is a pipe row, a delimiter row under it, and every pipe row after —
   with, above all of that, the one optional line carrying the table's own
   width. That line belongs to the table rather than sitting in front of it: it
   is inside the replaced range, so it is hidden with everything else and the
   caret steps over the whole table in one move. */
export function tableRunAt(doc: Text, line: number): TableRun | null {
  const attr = isTableAttr(doc.line(line).text)
  const head = attr ? line + 1 : line

  if (head + 1 > doc.lines) return null
  if (!isTableRow(doc.line(head).text)) return null
  if (!isDelimiterRow(doc.line(head + 1).text)) return null

  let last = head + 1
  while (last + 1 <= doc.lines && isTableRow(doc.line(last + 1).text)) last++

  const from = doc.line(line).from
  const to = doc.line(last).to
  return { from, to, firstLine: line, lastLine: last, text: doc.sliceString(from, to) }
}

/* ── the hand ────────────────────────────────────────────────────────────
   The rules are drawn over the table rather than set as borders, for two
   reasons. A border takes up height, and a one-pixel line between every row
   would walk the whole table off the 28px grid. And the felt pen wants a line
   that wanders, which no border can do.

   The wander is worked out from the line's own index, never from a random
   number — a table that re-drew itself differently on every keystroke would
   shiver as you typed. */
function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 2
}

function drawn(x1: number, y1: number, x2: number, y2: number, seed: number, amp: number) {
  if (amp === 0) return `M${x1} ${y1}L${x2} ${y2}`
  const length = Math.hypot(x2 - x1, y2 - y1)
  const steps = Math.max(2, Math.round(length / 46))
  const parts = [`M${x1 + wobble(seed) * amp} ${y1 + wobble(seed + 7) * amp}`]
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = x1 + (x2 - x1) * t + wobble(seed + i * 3.7) * amp
    const y = y1 + (y2 - y1) * t + wobble(seed + i * 5.1) * amp
    /* A quadratic through a nudged midpoint bows the line rather than
       kinking it, which is what a hand does and a polyline doesn't. */
    const px = x1 + (x2 - x1) * (t - 0.5 / steps) + wobble(seed + i * 2.3) * amp * 1.4
    const py = y1 + (y2 - y1) * (t - 0.5 / steps) + wobble(seed + i * 9.4) * amp * 1.4
    parts.push(`Q${px} ${py} ${x} ${y}`)
  }
  return parts.join('')
}

/* Both hands are drawn, every time, and CSS shows whichever pen the page is
   holding. Changing the pen doesn't change the document, so nothing would
   redraw the rules if the wander were worked out at draw time — and this way
   the switch is instant, which is the rule for anything between a tap and the
   page. */
function pair(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  cls: string,
) {
  for (const [hand, amp] of [
    ['ink', 0],
    ['felt', 1.1],
  ] as const) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', drawn(x1, y1, x2, y2, seed, amp))
    el.setAttribute('class', `${cls} md-hand-${hand}`)
    svg.appendChild(el)
  }
}

/* ── what a cell holds ───────────────────────────────────────────────────
   Markdown, the same as everything else on the page. But a cell is a
   contenteditable and the browser owns editing inside it, so the markdown is
   drawn as HTML going in and read back off the DOM coming out. That way ⌘B in
   a cell is the browser's own bold, and the file still gets `**`. */

const HL_COLORS = new Set(['oxblood', 'forest', 'navy', 'driftwood', 'brass'])

export function cellToHtml(text: string): string {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  /* Code is literal by definition, so it's set aside before anything else
     runs and put back at the end. */
  const stash: string[] = []
  s = s.replace(/`([^`]+)`/g, (_, t) => {
    stash.push(`<code>${t}</code>`)
    return `\u0000${stash.length - 1}\u0000`
  })

  /* The underline is the tag itself in the file, so it comes back out of the
     escaping it just went into. Before the other marks, so `<u>**a**</u>`
     still bolds. */
  s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>')

  s = s.replace(/==(?:\{(\w+)\})?([^=]+)==/g, (_, c, t) => {
    const color = c && HL_COLORS.has(c) ? c : 'brass'
    return `<span class="md-hl md-hl-${color}">${t}</span>`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)])
}

export function htmlToCell(node: Node): string {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? ''
      continue
    }
    if (!(child instanceof HTMLElement)) continue
    if (child.tagName === 'BR') {
      /* A cell is one line — the file has no way to say otherwise. */
      out += ' '
      continue
    }
    const inner = htmlToCell(child)
    if (!inner) continue
    const tag = child.tagName
    if (tag === 'STRONG' || tag === 'B') out += `**${inner}**`
    else if (tag === 'EM' || tag === 'I') out += `*${inner}*`
    else if (tag === 'U') out += `<u>${inner}</u>`
    else if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') out += `~~${inner}~~`
    else if (tag === 'CODE') out += `\`${inner}\``
    else if (child.classList.contains('md-hl')) {
      const color =
        [...child.classList].find((c) => c.startsWith('md-hl-'))?.slice(6) ?? 'brass'
      out += `=={${color}}${inner}==`
    } else out += inner
  }
  return out.replace(/\s+/g, ' ')
}

/* The cell the caret is in, if it is in one. The tray asks this before it
   reaches for CodeMirror, because inside a table the browser is the editor. */
export function focusedCell(): HTMLElement | null {
  const el = document.activeElement
  if (el instanceof HTMLElement && el.tagName === 'TD' && el.isContentEditable) return el
  return null
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* The element inside this cell that answers this question, if there is one.

   Walking up from where the caret is finds it in the common case; a selection
   made by dragging or by shift-arrowing from the end of the cell anchors
   *outside* the mark it covers, though, so anything the range merely crosses
   counts too. Getting that wrong is why taking a colour off a cell did
   nothing: the anchor was the cell itself and the walk stopped there. */
function markedIn(cell: HTMLElement, match: (el: HTMLElement) => boolean): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null

  const start = selection.anchorNode
  let el: HTMLElement | null = start instanceof HTMLElement ? start : (start?.parentElement ?? null)
  while (el && el.tagName !== 'TD') {
    if (match(el)) return el
    el = el.parentElement
  }

  const range = selection.getRangeAt(0)
  for (const candidate of cell.querySelectorAll('*')) {
    if (candidate instanceof HTMLElement && match(candidate) && range.intersectsNode(candidate)) {
      return candidate
    }
  }
  return null
}

/* Put something else in an element's place.

   By hand rather than through `execCommand('insertHTML')`, which quietly does
   nothing when the range it is handed is a whole element rather than a stretch
   of text. The cell only writes itself back to the file on `input`, so the
   event has to be raised here too — and CodeMirror still owns undo, because
   what `commitCells` sends it is a change to the document. */
function replaceElement(el: HTMLElement, html: string): void {
  const cell = el.closest('td')
  const fragment = document.createRange().createContextualFragment(html)
  const last = fragment.lastChild
  el.replaceWith(fragment)

  /* Leave the caret after what was just put in, so typing carries on from
     where the writer was rather than from the front of the cell. */
  const selection = window.getSelection()
  if (selection && last) {
    const range = document.createRange()
    range.setStartAfter(last)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  cell?.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

/* Emphasis, put on and taken off by hand rather than by `execCommand`.

   `execCommand('bold')` decides which way to go from the *computed* weight,
   and the head row is already set heavy — so in a head cell it read the text
   as bold and turned it off, leaving `<span style="font-weight: normal">`,
   which the file has no word for. The mark was dropped on the way back to
   markdown and the head cell un-bolded until the table next redrew.
   `execCommand('underline')` had the other half of it: one would go on and
   then never come off again.

   So the question asked is whether the caret is inside the tag, which is the
   only thing that decides what the file says. Taking a mark off takes the
   whole element rather than the part under the selection, the same trade the
   highlighter makes when it recolours a run. */
function toggleTag(cell: HTMLElement, tag: 'strong' | 'em' | 'u', tags: string[]): boolean {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return true

  const existing = markedIn(cell, (el) => tags.includes(el.tagName))
  if (existing) {
    replaceElement(existing, existing.innerHTML)
    return true
  }

  const text = selection.toString()
  if (!text) return true
  document.execCommand('insertHTML', false, `<${tag}>${escapeHtml(text)}</${tag}>`)
  return true
}

/* Marks inside a cell. Strike is the browser's own; the rest have no command
   that can be trusted here and get wrapped by hand. */
export function markInCell(
  mark: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'off' | string,
): boolean {
  const cell = focusedCell()
  if (!cell) return false

  if (mark === 'bold') return toggleTag(cell, 'strong', ['B', 'STRONG'])
  if (mark === 'italic') return toggleTag(cell, 'em', ['I', 'EM'])
  if (mark === 'underline') return toggleTag(cell, 'u', ['U'])
  if (mark === 'strike') {
    document.execCommand('strikeThrough')
    return true
  }

  const selection = window.getSelection()

  /* The highlighter, which has the same two questions to answer as it does out
     on the page: standing inside one changes its colour rather than starting
     another, and off takes the one it is standing in away. */
  if (mark === 'off' || HL_COLORS.has(mark)) {
    if (!selection?.rangeCount) return true
    const lit = markedIn(cell, (el) => el.classList.contains('md-hl'))
    if (mark === 'off') {
      if (lit) replaceElement(lit, lit.innerHTML)
      return true
    }
    if (lit) {
      replaceElement(lit, `<span class="md-hl md-hl-${mark}">${lit.innerHTML}</span>`)
      return true
    }
  }

  const text = selection?.toString() ?? ''
  if (!text) return true

  const safe = escapeHtml(text)
  if (mark === 'code') {
    document.execCommand('insertHTML', false, `<code>${safe}</code>`)
    return true
  }
  const color = HL_COLORS.has(mark) ? mark : 'brass'
  document.execCommand('insertHTML', false, `<span class="md-hl md-hl-${color}">${safe}</span>`)
  return true
}

export function capsInCell(): boolean {
  const cell = focusedCell()
  if (!cell) return false
  const selection = window.getSelection()
  const text = selection?.toString() ?? ''
  if (!text) return true
  const shouted = text === text.toUpperCase() && text !== text.toLowerCase()
  document.execCommand('insertText', false, shouted ? text.toLowerCase() : text.toUpperCase())
  return true
}

/* ── the widget ─────────────────────────────────────────────────────── */

interface Live {
  from: number
  to: number
  table: Table
}

type Host = HTMLElement & { live?: Live }

export class TableWidget extends WidgetType {
  constructor(
    readonly table: Table,
    readonly source: string,
    readonly from: number,
    readonly to: number,
  ) {
    super()
  }

  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from
  }

  toDOM(view: EditorView) {
    const host = document.createElement('div') as Host
    host.className = 'md-table'
    host.contentEditable = 'false'
    host.live = { from: this.from, to: this.to, table: this.table }

    const frame = document.createElement('div')
    frame.className = 'md-table-frame'

    const table = document.createElement('table')
    const colgroup = document.createElement('colgroup')
    const body = document.createElement('tbody')
    table.appendChild(colgroup)
    table.appendChild(body)
    frame.appendChild(table)

    const rules = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    rules.setAttribute('class', 'md-table-rules')
    rules.setAttribute('aria-hidden', 'true')
    frame.appendChild(rules)

    const handles = document.createElement('div')
    handles.className = 'md-table-handles'
    frame.appendChild(handles)

    host.appendChild(frame)
    host.appendChild(controlsFor(host, view))

    render(host, view)

    /* The controls belong to whoever is writing in the table, and go when they
       leave. The delay is so that pressing one of them doesn't count as
       leaving before the press lands. */
    let leaving: number | undefined
    host.addEventListener('focusin', () => {
      clearTimeout(leaving)
      host.classList.add('active')
    })
    host.addEventListener('focusout', () => {
      leaving = window.setTimeout(() => host.classList.remove('active'), 120)
    })

    return host
  }

  updateDOM(dom: HTMLElement, view: EditorView) {
    const host = dom as Host
    if (!host.live) return false
    /* Keeping the DOM is the whole point — rebuilding it on every keystroke
       would take the caret out of the cell being typed in. */
    host.live = { from: this.from, to: this.to, table: this.table }
    render(host, view)
    return true
  }

  ignoreEvent() {
    return true
  }
}

/* Write the table back into the document as markdown. */
function commit(host: Host, view: EditorView, next: Table) {
  const live = host.live
  if (!live) return
  const text = serializeTable(next)
  view.dispatch({ changes: { from: live.from, to: live.to, insert: text } })
}

/* Read what's in the cells right now and put it back in the file. */
function commitCells(host: Host, view: EditorView) {
  const live = host.live
  if (!live) return
  const rows: Cell[][] = []
  for (const tr of host.querySelectorAll('tr')) {
    const cells: Cell[] = []
    for (const td of tr.querySelectorAll('td')) {
      cells.push({
        text: htmlToCell(td).trim(),
        span: Number(td.getAttribute('colspan') ?? 1),
      })
    }
    rows.push(cells)
  }
  const text = serializeTable({ ...live.table, rows })
  if (text === view.state.sliceDoc(live.from, live.to)) return
  view.dispatch({ changes: { from: live.from, to: live.to, insert: text } })
}

function render(host: Host, view: EditorView) {
  const live = host.live
  if (!live) return
  const { table } = live
  const columns = table.widths.length

  const colgroup = host.querySelector('colgroup')
  const body = host.querySelector('tbody')
  const frame = host.querySelector('.md-table-frame')
  if (!colgroup || !body) return

  /* The table's share of the measure sits on the frame, so the rules and the
     grips — both of which are the frame's own children — are pulled in with
     it and nothing has to be told twice. */
  if (frame instanceof HTMLElement) {
    frame.style.width = `${clampWidth(table.width ?? FULL_WIDTH)}%`
  }

  /* Widths first — they're the only thing that has to be right before the
     rules are measured. */
  while (colgroup.children.length > columns) colgroup.lastElementChild?.remove()
  while (colgroup.children.length < columns) colgroup.appendChild(document.createElement('col'))
  table.widths.forEach((w, i) => {
    ;(colgroup.children[i] as HTMLElement).style.width = `${w}%`
  })

  const active = document.activeElement

  while (body.children.length > table.rows.length) body.lastElementChild?.remove()
  while (body.children.length < table.rows.length)
    body.appendChild(document.createElement('tr'))

  table.rows.forEach((row, r) => {
    const tr = body.children[r] as HTMLTableRowElement
    tr.className = r === 0 ? 'md-table-head' : ''
    while (tr.children.length > row.length) tr.lastElementChild?.remove()
    while (tr.children.length < row.length) {
      const td = document.createElement('td')
      td.contentEditable = 'true'
      cellHandlers(td, host, view)
      tr.appendChild(td)
    }
    row.forEach((cell, c) => {
      const td = tr.children[c] as HTMLTableCellElement
      td.setAttribute('colspan', String(cell.span))
      td.dataset.row = String(r)
      td.dataset.cell = String(c)
      /* Never write over the cell being typed in — that is what would move
         the caret to the front of the word. */
      if (td !== active && htmlToCell(td) !== cell.text) td.innerHTML = cellToHtml(cell.text)
    })
  })

  requestAnimationFrame(() => {
    drawRules(host)
    layHandles(host, view)
  })
}

function cellHandlers(td: HTMLElement, host: Host, view: EditorView) {
  td.addEventListener('input', () => commitCells(host, view))
  td.addEventListener('blur', () => commitCells(host, view))
  td.addEventListener('keydown', (event) => {
    /* Inside a cell the browser is the editor, so the marks are its own. */
    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase()
      const mark = key === 'b' ? 'bold' : key === 'i' ? 'italic' : null
      if (mark) {
        event.preventDefault()
        markInCell(mark)
        commitCells(host, view)
        return
      }
    }
    /* Enter would put a line break inside the cell, which the file has no way
       to say. It moves down a row instead, the way a spreadsheet does. */
    if (event.key === 'Enter') {
      event.preventDefault()
      const tr = td.parentElement
      const next = tr?.nextElementSibling?.children[Number(td.dataset.cell)]
      if (next instanceof HTMLElement) next.focus()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const cells = [...host.querySelectorAll('td')]
      const at = cells.indexOf(td as HTMLTableCellElement)
      const to = cells[at + (event.shiftKey ? -1 : 1)]
      if (to) to.focus()
      return
    }
    /* Everything else stays in the cell; letting it reach CodeMirror would
       move the caret in the document behind the table. */
    event.stopPropagation()
  })
  td.addEventListener('paste', (event) => {
    /* Paste as text — a cell holds a string, not a document. */
    event.preventDefault()
    const text = (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? ''
    document.execCommand('insertText', false, text.replace(/\s+/g, ' '))
  })
}

/* The rules are drawn from where the cells actually landed, so they're right
   whatever the text did inside them. */
function drawRules(host: Host) {
  const svg = host.querySelector('.md-table-rules') as SVGSVGElement | null
  const table = host.querySelector('table')
  if (!svg || !table) return

  const box = table.getBoundingClientRect()
  const w = table.offsetWidth
  const h = table.offsetHeight
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  svg.replaceChildren()

  let seed = 1

  /* The outside. */
  pair(svg, 0, 0, w, 0, seed++, 'md-rule-edge')
  pair(svg, 0, h, w, h, seed++, 'md-rule-edge')
  pair(svg, 0, 0, 0, h, seed++, 'md-rule-edge')
  pair(svg, w, 0, w, h, seed++, 'md-rule-edge')

  /* One line under each row, and one down each seam between cells — read off
     the cells themselves, so a merged cell simply has no line through it. */
  for (const tr of host.querySelectorAll('tr')) {
    const rowBox = tr.getBoundingClientRect()
    const y = Math.round(rowBox.bottom - box.top)
    if (y < h - 1) {
      pair(
        svg,
        0,
        y,
        w,
        y,
        seed++,
        tr.classList.contains('md-table-head') ? 'md-rule-head' : 'md-rule',
      )
    }
    for (const td of tr.querySelectorAll('td')) {
      const cellBox = td.getBoundingClientRect()
      const x = Math.round(cellBox.right - box.left)
      if (x < w - 1) {
        const top = Math.round(rowBox.top - box.top)
        const bottom = Math.round(rowBox.bottom - box.top)
        pair(svg, x, top, x, bottom, seed++, 'md-rule')
      }
    }
  }
}

/* A grip on every seam between columns. Dragging one moves the boundary and
   leaves the table the width it was.

   The seams are worked out from the column widths, never from the cells of
   the head row. Reading them off the head meant that merging anything up
   there swallowed the seams underneath it — and merging the whole head row,
   which is exactly what a title across the top is, left no grips at all and
   the columns simply stopped being resizable. */
function layHandles(host: Host, view: EditorView) {
  const holder = host.querySelector('.md-table-handles') as HTMLElement | null
  const table = host.querySelector('table')
  const head = host.querySelector('tr')
  if (!holder || !table || !head) return

  const live = host.live
  if (!live) return
  const columns = live.table.widths.length
  holder.replaceChildren()

  const at = (widths: number[], seam: number) => {
    let acc = 0
    for (let i = 0; i <= seam; i++) acc += widths[i]
    return (acc / 100) * table.offsetWidth
  }

  /* Does this row have a real cell boundary at this seam? A merged cell runs
     straight through one. */
  const breaksAt = (tr: HTMLTableRowElement, seam: number) => {
    let column = 0
    for (const td of tr.querySelectorAll('td')) {
      column += Number(td.getAttribute('colspan') ?? 1)
      if (column === seam + 1) return true
      if (column > seam + 1) return false
    }
    return false
  }

  const rows = [...host.querySelectorAll('tr')] as HTMLTableRowElement[]
  const top = table.getBoundingClientRect().top

  for (let seam = 0; seam < columns - 1; seam++) {
    /* A grip has to sit on a boundary that is actually drawn, or it lies over
       the middle of a merged cell and swallows the clicks meant for it — which
       is exactly what happens to a title merged across the head row. So it
       hangs on the first row that still breaks here, head or not, and a seam
       no row breaks at simply has no grip. */
    const row = rows.find((tr) => breaksAt(tr, seam))
    if (!row) continue

    const grip = document.createElement('div')
    grip.className = 'md-table-grip'
    grip.style.left = `${at(live.table.widths, seam)}px`
    /* Only as deep as its own row. Running the grip the whole height of the
       table put an invisible strip over every cell it passed, and a click
       near a column edge started a drag instead of putting the caret in the
       cell — which looks exactly like the cell being dead. */
    grip.style.top = `${row.getBoundingClientRect().top - top}px`
    grip.style.height = `${row.getBoundingClientRect().height}px`
    grip.dataset.seam = String(seam)
    grip.dataset.row = String(rows.indexOf(row))
    grip.setAttribute('role', 'separator')
    grip.setAttribute('aria-label', 'Column width')

    grip.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      grip.setPointerCapture(event.pointerId)

      const startX = event.clientX
      const width = table.offsetWidth
      const start = (host.live ?? live).table.widths.slice()
      let latest = start

      const move = (e: PointerEvent) => {
        const delta = ((e.clientX - startX) / width) * 100
        const next = start.slice()
        const room = start[seam] + start[seam + 1]
        next[seam] = Math.min(room - MIN_WIDTH, Math.max(MIN_WIDTH, start[seam] + delta))
        next[seam + 1] = room - next[seam]
        latest = next
        /* Move it live, write it on release — a dispatch per pointermove
           would fill the undo history with a drag. */
        const colgroup = host.querySelector('colgroup')
        next.forEach((w, i) => {
          const col = colgroup?.children[i]
          if (col instanceof HTMLElement) col.style.width = `${w}%`
        })
        grip.style.left = `${at(next, seam)}px`
        drawRules(host)
      }

      const up = () => {
        grip.removeEventListener('pointermove', move)
        grip.removeEventListener('pointerup', up)
        grip.removeEventListener('pointercancel', up)
        commit(host, view, setWidths((host.live ?? live).table, latest))
      }

      grip.addEventListener('pointermove', move)
      grip.addEventListener('pointerup', up)
      grip.addEventListener('pointercancel', up)
    })

    holder.appendChild(grip)
  }

  /* And one on the outside edge, which moves the whole table rather than a
     boundary inside it. The columns keep their shares, so pulling the table
     in narrows all of them together instead of rearranging what is in it.

     It can run the full height where the column grips can't: it sits on the
     outer edge, past the last cell, so there is nothing underneath it whose
     clicks it could swallow. */
  const edge = document.createElement('div')
  edge.className = 'md-table-grip edge'
  edge.setAttribute('role', 'separator')
  edge.setAttribute('aria-label', 'Table width')
  edge.style.left = `${table.offsetWidth}px`
  edge.style.top = '0'
  edge.style.height = `${table.offsetHeight}px`

  edge.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    edge.setPointerCapture(event.pointerId)

    const startX = event.clientX
    /* The host is the whole measure; the frame inside it is the table. A
       percentage only means anything against the room the table has. */
    const measure = host.offsetWidth || table.offsetWidth
    const start = clampWidth((host.live ?? live).table.width ?? FULL_WIDTH)
    let latest = start

    const move = (e: PointerEvent) => {
      const delta = ((e.clientX - startX) / measure) * 100
      latest = Math.min(FULL_WIDTH, Math.max(MIN_TABLE_WIDTH, Math.round(start + delta)))
      const frame = host.querySelector('.md-table-frame')
      if (frame instanceof HTMLElement) frame.style.width = `${latest}%`
      /* Everything hanging off the table's edges moved with it. */
      placeGrips(host)
      drawRules(host)
    }

    const up = () => {
      edge.removeEventListener('pointermove', move)
      edge.removeEventListener('pointerup', up)
      edge.removeEventListener('pointercancel', up)
      commit(host, view, setTableWidth((host.live ?? live).table, latest))
    }

    edge.addEventListener('pointermove', move)
    edge.addEventListener('pointerup', up)
    edge.addEventListener('pointercancel', up)
  })

  holder.appendChild(edge)
}

/* Put every grip back where the table now says it goes. Only the table's own
   width needs this — moving one seam leaves every other seam exactly where it
   was, because the two columns either side of it trade the same room. */
function placeGrips(host: Host) {
  const holder = host.querySelector('.md-table-handles')
  const table = host.querySelector('table')
  const widths = host.live?.table.widths
  if (!holder || !table || !widths) return

  const width = table.offsetWidth
  const top = table.getBoundingClientRect().top
  const rows = [...host.querySelectorAll('tr')] as HTMLTableRowElement[]

  for (const grip of holder.querySelectorAll('.md-table-grip')) {
    if (!(grip instanceof HTMLElement)) continue
    if (grip.classList.contains('edge')) {
      grip.style.left = `${width}px`
      grip.style.height = `${table.offsetHeight}px`
      continue
    }
    const seam = Number(grip.dataset.seam)
    let acc = 0
    for (let i = 0; i <= seam; i++) acc += widths[i]
    grip.style.left = `${(acc / 100) * width}px`
    /* A narrower table wraps cells, which moves the rows the grips hang on. */
    const row = rows[Number(grip.dataset.row)]
    if (row) {
      const box = row.getBoundingClientRect()
      grip.style.top = `${box.top - top}px`
      grip.style.height = `${box.height}px`
    }
  }
}

function controlsFor(host: Host, view: EditorView): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'md-table-controls'

  /* Whichever cell was last written in is what the controls act on. */
  const focused = () => {
    const el = document.activeElement
    if (el instanceof HTMLElement && el.dataset.row && host.contains(el)) {
      return { row: Number(el.dataset.row), cell: Number(el.dataset.cell) }
    }
    return null
  }

  const control = (label: string, title: string, run: () => void) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'md-table-control'
    button.textContent = label
    button.title = title
    button.setAttribute('aria-label', title)
    button.addEventListener('mousedown', (e) => e.preventDefault())
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      run()
    })
    bar.appendChild(button)
  }

  const table = () => host.live?.table

  control('+ row', 'Add a row', () => {
    const t = table()
    if (t) commit(host, view, addRow(t, focused()?.row ?? t.rows.length - 1))
  })
  control('− row', 'Remove this row', () => {
    const t = table()
    if (t) commit(host, view, removeRow(t, focused()?.row ?? t.rows.length - 1))
  })

  const gap = document.createElement('span')
  gap.className = 'md-table-control-gap'
  bar.appendChild(gap)

  control('+ col', 'Add a column', () => {
    const t = table()
    if (!t) return
    const at = focused()
    const column = at ? columnOf(t.rows[at.row], at.cell) : t.widths.length - 1
    commit(host, view, addColumn(t, column))
  })
  control('− col', 'Remove this column', () => {
    const t = table()
    if (!t) return
    const at = focused()
    const column = at ? columnOf(t.rows[at.row], at.cell) : t.widths.length - 1
    commit(host, view, removeColumn(t, column))
  })

  const gap2 = document.createElement('span')
  gap2.className = 'md-table-control-gap'
  bar.appendChild(gap2)

  control('full', 'Back to the full measure', () => {
    const t = table()
    if (t) commit(host, view, setTableWidth(t, FULL_WIDTH))
  })

  const gap3 = document.createElement('span')
  gap3.className = 'md-table-control-gap'
  bar.appendChild(gap3)

  control('merge', 'Join this cell to the one on its right', () => {
    const t = table()
    const at = focused()
    if (t && at) commit(host, view, mergeAt(t, at.row, at.cell))
  })
  control('split', 'Give the merged column back', () => {
    const t = table()
    const at = focused()
    if (t && at) commit(host, view, splitAt(t, at.row, at.cell))
  })

  return bar
}

/* ── putting one on the page ─────────────────────────────────────────── */

export function tableDecoration(run: TableRun): Decoration | null {
  const parsed = parseTable(run.text.split('\n'))
  if (!parsed) return null
  return Decoration.replace({
    widget: new TableWidget(parsed, run.text, run.from, run.to),
    block: true,
  })
}

/* A table goes in on its own lines, with a blank one after it so there is
   always somewhere for the caret to go when it comes back out. */
export function insertTable(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  const line = state.doc.lineAt(range.from)
  const blank = line.text.trim() === ''
  const markdown = serializeTable(emptyTable())
  const insert = (blank ? '' : '\n') + markdown + '\n\n'
  const at = blank ? line.from : line.to

  view.dispatch({
    changes: { from: at, to: blank ? line.to : at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}
