/* A table is a GFM pipe table, and the file says so in plain markdown.

   Two things a spreadsheet needs that a pipe table has no word for, and how
   each is said here:

   Column width comes from how many dashes sit in the delimiter row. That is
   already how an eye reads a hand-aligned table, it is entirely valid GFM,
   and no other editor has to know we meant anything by it.

   A merge is a cell holding nothing but `<`, meaning "joined to the one on my
   left". This one is a convention rather than a standard — but the obvious
   alternative, an empty cell meaning merged, costs the ability to leave a
   cell blank, and a spreadsheet needs blank cells far more often than it
   needs merged ones. */

export const MERGE_MARK = '<'

/* And a third thing a pipe table has no word for: how wide the whole table
   sits. The two above ride inside the table's own syntax because they could;
   this one can't. The delimiter row is the only place with a number in it,
   and its dashes already mean the columns' shares of the width — reading a
   total out of them as well would mean a table hand-aligned in another editor
   arrived here two thirds the size it was written at. So the width goes on a
   line of its own above the table, in the brace-tag shape the app already
   uses for a highlight's colour and a picture's placement, and it is only
   written at all when the table is narrower than the measure. A table at its
   full width — which is nearly all of them — is exactly the GFM it always
   was. */
const TABLE_ATTR_RE = /^\{table (\d{1,3})\}$/

export function isTableAttr(line: string): boolean {
  return TABLE_ATTR_RE.test(line.trim())
}

export const FULL_WIDTH = 100
export const MIN_TABLE_WIDTH = 20

/* Enough dashes to carry a width to about a percent, few enough that the
   delimiter row still fits on a line worth reading. */
const TOTAL_DASHES = 72
const MIN_DASHES = 3

export interface Cell {
  text: string
  /* How many columns this cell covers. One unless something was merged. */
  span: number
}

export interface Table {
  /* The head is the first row; everything after it is the body. */
  rows: Cell[][]
  /* Percentages of the table, one per column, summing to a hundred. */
  widths: number[]
  /* And the table's own share of the measure. A hundred unless it was
     deliberately pulled in. */
  width: number
}

const ROW_RE = /^\s*\|.*\|\s*$/
const DELIM_RE = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/

export function isTableRow(line: string): boolean {
  return ROW_RE.test(line)
}

export function isDelimiterRow(line: string): boolean {
  return DELIM_RE.test(line)
}

/* A pipe inside a cell is escaped, so the split has to respect the backslash
   or a cell containing "a|b" quietly becomes two cells. */
function splitCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const out: string[] = []
  let current = ''
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === '\\' && inner[i + 1] === '|') {
      current += '|'
      i++
      continue
    }
    if (c === '|') {
      out.push(current.trim())
      current = ''
      continue
    }
    current += c
  }
  out.push(current.trim())
  return out
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function toCells(raw: string[], columns: number): Cell[] {
  const cells: Cell[] = []
  let span = 0
  for (const text of raw) {
    if (span >= columns) break
    if (text === MERGE_MARK && cells.length) {
      cells[cells.length - 1].span++
      span++
      continue
    }
    cells.push({ text: text === MERGE_MARK ? '' : text, span: 1 })
    span++
  }
  while (span < columns) {
    cells.push({ text: '', span: 1 })
    span++
  }
  return cells
}

export function parseTable(lines: string[]): Table | null {
  let width = FULL_WIDTH
  const attr = lines[0]?.trim().match(TABLE_ATTR_RE)
  if (attr) {
    width = clampWidth(Number(attr[1]))
    lines = lines.slice(1)
  }

  if (lines.length < 2) return null
  if (!isTableRow(lines[0]) || !isDelimiterRow(lines[1])) return null

  const delim = splitCells(lines[1])
  const columns = delim.length
  if (!columns) return null

  const dashes = delim.map((d) => Math.max(1, (d.match(/-/g) ?? []).length))
  const total = dashes.reduce((a, b) => a + b, 0)
  const widths = dashes.map((d) => (d / total) * 100)

  const rows: Cell[][] = []
  for (let i = 0; i < lines.length; i++) {
    if (i === 1) continue
    rows.push(toCells(splitCells(lines[i]), columns))
  }
  return { rows, widths, width }
}

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return FULL_WIDTH
  return Math.min(FULL_WIDTH, Math.max(MIN_TABLE_WIDTH, Math.round(width)))
}

function rowLine(row: Cell[]): string {
  const parts: string[] = []
  for (const cell of row) {
    parts.push(escapeCell(cell.text))
    for (let i = 1; i < cell.span; i++) parts.push(MERGE_MARK)
  }
  return `| ${parts.join(' | ')} |`
}

function delimiterLine(widths: number[]): string {
  const total = widths.reduce((a, b) => a + b, 0) || 1
  const dashes = widths.map((w) => Math.max(MIN_DASHES, Math.round((w / total) * TOTAL_DASHES)))
  return `| ${dashes.map((n) => '-'.repeat(n)).join(' | ')} |`
}

export function serializeTable(table: Table): string {
  const [head, ...body] = table.rows
  const width = clampWidth(table.width ?? FULL_WIDTH)
  const lines = width < FULL_WIDTH ? [`{table ${width}}`] : []
  lines.push(rowLine(head ?? []), delimiterLine(table.widths))
  for (const row of body) lines.push(rowLine(row))
  return lines.join('\n')
}

/* ── the shapes a table can be put into ──────────────────────────────── */

function blankRow(columns: number): Cell[] {
  return Array.from({ length: columns }, () => ({ text: '', span: 1 }))
}

export function emptyTable(columns = 3, bodyRows = 2): Table {
  const share = 100 / columns
  return {
    rows: [blankRow(columns), ...Array.from({ length: bodyRows }, () => blankRow(columns))],
    widths: Array.from({ length: columns }, () => share),
    width: FULL_WIDTH,
  }
}

export function columnCount(table: Table): number {
  return table.widths.length
}

export function addRow(table: Table, after: number): Table {
  const rows = table.rows.slice()
  rows.splice(Math.max(1, after + 1), 0, blankRow(columnCount(table)))
  return { ...table, rows }
}

/* The head row is the table's spine and never goes. */
export function removeRow(table: Table, at: number): Table {
  if (at <= 0 || table.rows.length <= 2) return table
  const rows = table.rows.slice()
  rows.splice(at, 1)
  return { ...table, rows }
}

export function addColumn(table: Table, after: number): Table {
  const columns = columnCount(table)
  const at = Math.min(columns, Math.max(0, after + 1))

  /* Widths are shares of the measure, so the new one takes an even cut from
     everything already there rather than pushing the table wider. */
  const share = 100 / (columns + 1)
  const scale = (100 - share) / 100
  const widths = table.widths.map((w) => w * scale)
  widths.splice(at, 0, share)

  const rows = table.rows.map((row) => {
    const out: Cell[] = []
    let column = 0
    let placed = false
    for (const cell of row) {
      if (column === at && !placed) {
        out.push({ text: '', span: 1 })
        placed = true
      }
      /* A cell already spanning the seam simply grows to cover the new
         column — splitting it would be a stranger answer than widening it. */
      if (!placed && column < at && column + cell.span > at) {
        out.push({ ...cell, span: cell.span + 1 })
        placed = true
        column += cell.span
        continue
      }
      out.push({ ...cell })
      column += cell.span
    }
    if (!placed) out.push({ text: '', span: 1 })
    return out
  })

  return { ...table, rows, widths }
}

export function removeColumn(table: Table, at: number): Table {
  const columns = columnCount(table)
  if (columns <= 1) return table

  const widths = table.widths.slice()
  const [gone] = widths.splice(at, 1)
  const scale = 100 / (100 - gone)
  const scaled = widths.map((w) => w * scale)

  const rows = table.rows.map((row) => {
    const out: Cell[] = []
    let column = 0
    for (const cell of row) {
      const covers = at >= column && at < column + cell.span
      if (covers) {
        if (cell.span > 1) out.push({ ...cell, span: cell.span - 1 })
      } else {
        out.push({ ...cell })
      }
      column += cell.span
    }
    return out.length ? out : blankRow(columns - 1)
  })

  return { ...table, rows, widths: scaled }
}

/* Merging is per row — that is the whole point of it. The cell takes in the
   one to its right; splitting hands the columns back one at a time. */
export function mergeAt(table: Table, row: number, index: number): Table {
  const rows = table.rows.slice()
  const cells = rows[row]?.slice()
  if (!cells || index < 0 || index >= cells.length - 1) return table

  const left = cells[index]
  const right = cells[index + 1]
  cells.splice(index, 2, {
    text: [left.text, right.text].filter(Boolean).join(' '),
    span: left.span + right.span,
  })
  rows[row] = cells
  return { ...table, rows }
}

export function splitAt(table: Table, row: number, index: number): Table {
  const rows = table.rows.slice()
  const cells = rows[row]?.slice()
  if (!cells) return table
  const cell = cells[index]
  if (!cell || cell.span < 2) return table

  cells.splice(index, 1, { text: cell.text, span: cell.span - 1 }, { text: '', span: 1 })
  rows[row] = cells
  return { ...table, rows }
}

export function setWidths(table: Table, widths: number[]): Table {
  return { ...table, widths }
}

/* The whole table, narrower or wider. The columns keep their shares of it, so
   pulling the table in doesn't rearrange what is inside it. */
export function setTableWidth(table: Table, width: number): Table {
  return { ...table, width: clampWidth(width) }
}

/* Where a cell sits in columns, so the widget can size and seam it. */
export function columnOf(row: Cell[], index: number): number {
  let column = 0
  for (let i = 0; i < index; i++) column += row[i].span
  return column
}
