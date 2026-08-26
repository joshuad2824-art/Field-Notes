/* A table is a GFM pipe table, and the file says so in plain markdown.

   Three things a spreadsheet needs that a pipe table has no word for, and how
   each is said here:

   Column width comes from how many dashes sit in the delimiter row. That is
   already how an eye reads a hand-aligned table, it is entirely valid GFM,
   and no other editor has to know we meant anything by it.

   A merge across is a cell holding nothing but `<`, meaning "joined to the one
   on my left". This one is a convention rather than a standard — but the
   obvious alternative, an empty cell meaning merged, costs the ability to
   leave a cell blank, and a spreadsheet needs blank cells far more often than
   it needs merged ones.

   A merge down is a cell holding nothing but `^`, meaning "joined to the one
   above me". It is the same class of decision as `<` and it is said the same
   way for the same reason: a table that could only ever be merged along a row
   is not a spreadsheet, and it was the first thing daily use asked for. The
   two compose — a block merged both ways carries `<` across its head row and
   `^` through every row under it — so a rectangle of any size is one cell and
   the file still opens anywhere as a table with a few odd characters in it.

   Alignment is *not* in that list. GFM already has a word for it — colons in
   the delimiter row — and this reader used to throw them away, which meant a
   table written in any other editor arrived here having quietly lost
   something the file plainly said. It is read and written now. */

export const MERGE_MARK = '<'
export const MERGE_UP_MARK = '^'

/* And a fourth thing a pipe table has no word for: how wide the whole table
   sits. The three above ride inside the table's own syntax because they
   could; this one can't. The delimiter row is the only place with a number in
   it, and its dashes already mean the columns' shares of the width — reading
   a total out of them as well would mean a table hand-aligned in another
   editor arrived here two thirds the size it was written at. So the width
   goes on a line of its own above the table, in the brace-tag shape the app
   already uses for a highlight's colour and a picture's placement, and it is
   only written at all when the table is narrower than the measure. A table at
   its full width — which is nearly all of them — is exactly the GFM it always
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

export type Align = 'left' | 'center' | 'right'

export interface Cell {
  text: string
  /* How many columns this cell covers. One unless something was merged. */
  span: number
  /* And how many rows. One unless something was merged downward. */
  rows: number
}

export interface Table {
  /* The head is the first row; everything after it is the body. A row holds
     only the cells that *begin* in it — a cell merged down from above is not
     listed again, exactly as a `<tr>` doesn't list it again. */
  rows: Cell[][]
  /* Percentages of the table, one per column, summing to a hundred. */
  widths: number[]
  /* Where the writing sits in each column. GFM's own, read off the colons. */
  aligns: Align[]
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
  const escaped = text.replace(/\|/g, '\\|')
  /* A cell whose whole writing is a merge mark would be read back as a merge.
     Nothing anyone types is likely to be exactly `<` or `^` — but a block
     pasted out of a spreadsheet can be, and a paste that silently welds two
     cells together is the worst kind of surprise. A backslash in front is
     what markdown already means by "the character itself". */
  if (escaped === MERGE_MARK || escaped === MERGE_UP_MARK) return `\\${escaped}`
  return escaped
}

/* And the way back, applied before a cell is read as a mark. */
function literal(text: string): string {
  return text === `\\${MERGE_MARK}` || text === `\\${MERGE_UP_MARK}` ? text.slice(1) : text
}

/* ── the grid ────────────────────────────────────────────────────────────
   A `Table` is what a `<tr>` wants: the cells that begin in each row. Every
   operation on it — adding a column, taking a row out, merging a rectangle —
   wants the other view, where every position in the grid says which cell
   covers it. So the operations go out to a grid, do their work there, and
   come back. Nothing else in the app ever sees this shape. */

interface Block {
  row: number
  column: number
  span: number
  rows: number
  text: string
}

interface Grid {
  blocks: Block[]
  columns: number
  height: number
}

function toGrid(table: Table): Grid {
  const columns = Math.max(1, table.widths.length)
  const height = table.rows.length
  /* Which block covers each position, so a cell knows where it can start. */
  const taken: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: columns }, () => false),
  )
  const blocks: Block[] = []

  table.rows.forEach((row, r) => {
    let c = 0
    for (const cell of row) {
      while (c < columns && taken[r][c]) c++
      if (c >= columns) break
      const span = Math.min(Math.max(1, cell.span), columns - c)
      const rows = Math.min(Math.max(1, cell.rows ?? 1), height - r)
      for (let dr = 0; dr < rows; dr++) {
        for (let dc = 0; dc < span; dc++) taken[r + dr][c + dc] = true
      }
      blocks.push({ row: r, column: c, span, rows, text: cell.text })
      c += span
    }
  })

  /* Anything nothing claimed is an ordinary empty cell — a short row in the
     file, or a merge that overran. */
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) {
      if (!taken[r][c]) blocks.push({ row: r, column: c, span: 1, rows: 1, text: '' })
    }
  }

  return { blocks, columns, height }
}

function fromGrid(grid: Grid, widths: number[], aligns: Align[], width: number): Table {
  const rows: Cell[][] = Array.from({ length: grid.height }, () => [])
  const sorted = grid.blocks.slice().sort((a, b) => a.row - b.row || a.column - b.column)
  for (const block of sorted) {
    if (block.row < 0 || block.row >= grid.height) continue
    rows[block.row].push({ text: block.text, span: block.span, rows: block.rows })
  }
  return {
    rows,
    widths: normalise(widths, grid.columns),
    aligns: fitAligns(aligns, grid.columns),
    width: clampWidth(width),
  }
}

/* Shares of the table, always summing to a hundred and never fewer than the
   columns there are. */
function normalise(widths: number[], columns: number): number[] {
  const out = widths.slice(0, columns)
  while (out.length < columns) out.push(100 / columns)
  const total = out.reduce((a, b) => a + b, 0)
  if (!total) return Array.from({ length: columns }, () => 100 / columns)
  return out.map((w) => (w / total) * 100)
}

function fitAligns(aligns: Align[], columns: number): Align[] {
  const out = aligns.slice(0, columns)
  while (out.length < columns) out.push('left')
  return out
}

/* Where each block sits, by position, so a click on a cell can be turned into
   the block it belongs to and back again. */
export interface Placed {
  /* Which row of `table.rows` holds it, and where in that row. */
  row: number
  index: number
  /* And where it sits in the grid. */
  top: number
  column: number
  span: number
  rows: number
}

export function placement(table: Table): Placed[] {
  const columns = Math.max(1, table.widths.length)
  const height = table.rows.length
  const taken: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: columns }, () => false),
  )
  const out: Placed[] = []
  table.rows.forEach((row, r) => {
    let c = 0
    row.forEach((cell, index) => {
      while (c < columns && taken[r][c]) c++
      if (c >= columns) return
      const span = Math.min(Math.max(1, cell.span), columns - c)
      const rows = Math.min(Math.max(1, cell.rows ?? 1), height - r)
      for (let dr = 0; dr < rows; dr++) {
        for (let dc = 0; dc < span; dc++) taken[r + dr][c + dc] = true
      }
      out.push({ row: r, index, top: r, column: c, span, rows })
      c += span
    })
  })
  return out
}

/* The cell covering a position in the grid, whichever row it began in. */
export function cellAt(table: Table, top: number, column: number): Placed | null {
  for (const p of placement(table)) {
    if (top >= p.top && top < p.top + p.rows && column >= p.column && column < p.column + p.span) {
      return p
    }
  }
  return null
}

/* ── reading and writing the file ────────────────────────────────────── */

function alignOf(delim: string): Align {
  const left = delim.trim().startsWith(':')
  const right = delim.trim().endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
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
  const aligns = delim.map(alignOf)

  /* Every row in the file, split and padded, so the marks can be read as a
     grid before anything is decided about spans. */
  const raw: string[][] = []
  for (let i = 0; i < lines.length; i++) {
    if (i === 1) continue
    const cells = splitCells(lines[i]).slice(0, columns)
    while (cells.length < columns) cells.push('')
    raw.push(cells)
  }
  const height = raw.length
  if (!height) return null

  /* Pass one: what each position says about itself. */
  const kind: ('origin' | 'left' | 'up')[][] = raw.map((row) =>
    row.map((text) => (text === MERGE_MARK ? 'left' : text === MERGE_UP_MARK ? 'up' : 'origin')),
  )
  /* An escaped mark is writing, not a mark. */
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) raw[r][c] = literal(raw[r][c])
  }
  /* A mark in the first row or the first column has nothing to join to, so it
     is only ever the character itself. */
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) {
      if (kind[r][c] === 'left' && c === 0) kind[r][c] = 'origin'
      if (kind[r][c] === 'up' && r === 0) kind[r][c] = 'origin'
    }
  }

  /* Pass two: grow each origin over the marks that point back at it, and
     claim the rectangle so nothing inside it is read twice. */
  const claimed: boolean[][] = raw.map((row) => row.map(() => false))
  const blocks: Block[] = []
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) {
      if (kind[r][c] !== 'origin' || claimed[r][c]) continue
      let span = 1
      while (c + span < columns && kind[r][c + span] === 'left' && !claimed[r][c + span]) span++
      let rows = 1
      while (r + rows < height && kind[r + rows][c] === 'up' && !claimed[r + rows][c]) rows++
      for (let dr = 0; dr < rows; dr++) {
        for (let dc = 0; dc < span; dc++) claimed[r + dr][c + dc] = true
      }
      blocks.push({ row: r, column: c, span, rows, text: raw[r][c] })
    }
  }
  /* Anything left is a mark that pointed at nothing — keep it as its own
     cell rather than losing the row's shape over it. */
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) {
      if (!claimed[r][c]) blocks.push({ row: r, column: c, span: 1, rows: 1, text: raw[r][c] })
    }
  }

  return fromGrid({ blocks, columns, height }, widths, aligns, width)
}

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return FULL_WIDTH
  return Math.min(FULL_WIDTH, Math.max(MIN_TABLE_WIDTH, Math.round(width)))
}

function delimiterLine(widths: number[], aligns: Align[]): string {
  const total = widths.reduce((a, b) => a + b, 0) || 1
  const dashes = widths.map((w) => Math.max(MIN_DASHES, Math.round((w / total) * TOTAL_DASHES)))
  const parts = dashes.map((n, i) => {
    const align = aligns[i] ?? 'left'
    /* The colons take the place of a dash each, so a column keeps the width
       it was given whichever way its writing sits. */
    if (align === 'center') return `:${'-'.repeat(Math.max(1, n - 2))}:`
    if (align === 'right') return `${'-'.repeat(Math.max(2, n - 1))}:`
    return '-'.repeat(n)
  })
  return `| ${parts.join(' | ')} |`
}

export function serializeTable(table: Table): string {
  const grid = toGrid(table)
  if (!grid.height) return ''
  const owner: (Block | null)[][] = Array.from({ length: grid.height }, () =>
    Array.from({ length: grid.columns }, () => null),
  )
  for (const block of grid.blocks) {
    for (let dr = 0; dr < block.rows; dr++) {
      for (let dc = 0; dc < block.span; dc++) {
        const r = block.row + dr
        const c = block.column + dc
        if (owner[r]?.[c] !== undefined) owner[r][c] = block
      }
    }
  }

  const width = clampWidth(table.width ?? FULL_WIDTH)
  const lines = width < FULL_WIDTH ? [`{table ${width}}`] : []

  const rowLine = (r: number) => {
    const parts: string[] = []
    for (let c = 0; c < grid.columns; c++) {
      const block = owner[r][c]
      if (!block) parts.push('')
      else if (block.row !== r) parts.push(MERGE_UP_MARK)
      else if (block.column !== c) parts.push(MERGE_MARK)
      else parts.push(escapeCell(block.text))
    }
    return `| ${parts.join(' | ')} |`
  }

  lines.push(rowLine(0), delimiterLine(table.widths, table.aligns ?? []))
  for (let r = 1; r < grid.height; r++) lines.push(rowLine(r))
  return lines.join('\n')
}

/* ── the shapes a table can be put into ──────────────────────────────── */

function blankRow(columns: number): Cell[] {
  return Array.from({ length: columns }, () => ({ text: '', span: 1, rows: 1 }))
}

export function emptyTable(columns = 3, bodyRows = 2): Table {
  const share = 100 / columns
  return {
    rows: [blankRow(columns), ...Array.from({ length: bodyRows }, () => blankRow(columns))],
    widths: Array.from({ length: columns }, () => share),
    aligns: Array.from({ length: columns }, () => 'left' as Align),
    width: FULL_WIDTH,
  }
}

export function columnCount(table: Table): number {
  return table.widths.length
}

export function rowCount(table: Table): number {
  return table.rows.length
}

/* A row goes in under the one named. Anything merged across the seam simply
   grows — cutting a merged cell in half to make room would be a stranger
   answer than making it a row taller. */
export function addRow(table: Table, after: number): Table {
  const grid = toGrid(table)
  const at = Math.min(grid.height - 1, Math.max(0, after))
  for (const block of grid.blocks) {
    if (block.row > at) block.row++
    else if (block.row + block.rows - 1 > at) block.rows++
  }
  for (let c = 0; c < grid.columns; c++) {
    if (!grid.blocks.some((b) => b.row <= at + 1 && b.row + b.rows > at + 1 && b.column <= c && b.column + b.span > c)) {
      grid.blocks.push({ row: at + 1, column: c, span: 1, rows: 1, text: '' })
    }
  }
  grid.height++
  return fromGrid(grid, table.widths, table.aligns, table.width)
}

/* The head row is the table's spine and never goes. */
export function removeRow(table: Table, at: number): Table {
  if (at <= 0 || table.rows.length <= 2) return table
  const grid = toGrid(table)
  const kept: Block[] = []
  for (const block of grid.blocks) {
    if (block.row > at) {
      block.row--
      kept.push(block)
      continue
    }
    if (block.row + block.rows - 1 >= at) {
      block.rows--
      if (block.rows > 0) kept.push(block)
      continue
    }
    kept.push(block)
  }
  grid.blocks = kept
  grid.height--
  return fromGrid(grid, table.widths, table.aligns, table.width)
}

/* `after` is the column the new one goes to the right of. Minus one is the
   one position the plain control cannot otherwise reach: a new first
   column. */
export function addColumn(table: Table, after: number): Table {
  const grid = toGrid(table)
  const columns = grid.columns
  const at = Math.min(columns - 1, Math.max(-1, after))

  for (const block of grid.blocks) {
    if (block.column > at) block.column++
    else if (block.column + block.span - 1 > at) block.span++
  }
  for (let r = 0; r < grid.height; r++) {
    if (!grid.blocks.some((b) => b.column <= at + 1 && b.column + b.span > at + 1 && b.row <= r && b.row + b.rows > r)) {
      grid.blocks.push({ row: r, column: at + 1, span: 1, rows: 1, text: '' })
    }
  }
  grid.columns++

  /* Widths are shares of the measure, so the new one takes an even cut from
     everything already there rather than pushing the table wider. */
  const share = 100 / (columns + 1)
  const scale = (100 - share) / 100
  const widths = table.widths.map((w) => w * scale)
  widths.splice(at + 1, 0, share)
  const aligns = fitAligns(table.aligns ?? [], columns).slice()
  aligns.splice(at + 1, 0, 'left')

  return fromGrid(grid, widths, aligns, table.width)
}

export function removeColumn(table: Table, column: number): Table {
  const grid = toGrid(table)
  if (grid.columns <= 1) return table
  const at = Math.min(grid.columns - 1, Math.max(0, column))

  const kept: Block[] = []
  for (const block of grid.blocks) {
    if (block.column > at) {
      block.column--
      kept.push(block)
      continue
    }
    if (block.column + block.span - 1 >= at) {
      block.span--
      if (block.span > 0) kept.push(block)
      continue
    }
    kept.push(block)
  }
  grid.blocks = kept
  grid.columns--

  const widths = table.widths.slice()
  const [gone] = widths.splice(at, 1)
  const scale = 100 / Math.max(1e-6, 100 - gone)
  const aligns = fitAligns(table.aligns ?? [], table.widths.length).slice()
  aligns.splice(at, 1)

  return fromGrid(grid, widths.map((w) => w * scale), aligns, table.width)
}

/* ── merging ─────────────────────────────────────────────────────────────
   A rectangle of the grid becomes one cell. Which way the rectangle was drawn
   is not a question the table has to answer: a range picked from the right
   and one picked from the left are the same three cells, so `merge` takes a
   rectangle rather than a direction and "only merges left to right" stops
   being a thing that can be true. */

export interface Rect {
  top: number
  left: number
  bottom: number
  right: number
}

export function normaliseRect(a: { top: number; column: number }, b: { top: number; column: number }): Rect {
  return {
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.top, b.top),
    left: Math.min(a.column, b.column),
    right: Math.max(a.column, b.column),
  }
}

/* A rectangle that clips a merged cell in half is not a rectangle the file
   can say, so it grows until it holds every cell it touches whole. */
function settle(grid: Grid, rect: Rect): Rect {
  const out = { ...rect }
  for (let pass = 0; pass < 8; pass++) {
    let grew = false
    for (const block of grid.blocks) {
      const hits =
        block.row <= out.bottom &&
        block.row + block.rows - 1 >= out.top &&
        block.column <= out.right &&
        block.column + block.span - 1 >= out.left
      if (!hits) continue
      if (block.row < out.top) (out.top = block.row), (grew = true)
      if (block.row + block.rows - 1 > out.bottom) (out.bottom = block.row + block.rows - 1), (grew = true)
      if (block.column < out.left) (out.left = block.column), (grew = true)
      if (block.column + block.span - 1 > out.right) (out.right = block.column + block.span - 1), (grew = true)
    }
    if (!grew) break
  }
  return out
}

export function mergeRect(table: Table, rect: Rect): Table {
  const grid = toGrid(table)
  const box = settle(grid, {
    top: Math.max(0, rect.top),
    bottom: Math.min(grid.height - 1, rect.bottom),
    left: Math.max(0, rect.left),
    right: Math.min(grid.columns - 1, rect.right),
  })
  if (box.top === box.bottom && box.left === box.right) return table

  const inside = grid.blocks.filter(
    (b) => b.row >= box.top && b.row <= box.bottom && b.column >= box.left && b.column <= box.right,
  )
  const text = inside
    .slice()
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join(' ')

  grid.blocks = grid.blocks.filter((b) => !inside.includes(b))
  grid.blocks.push({
    row: box.top,
    column: box.left,
    span: box.right - box.left + 1,
    rows: box.bottom - box.top + 1,
    text,
  })
  return fromGrid(grid, table.widths, table.aligns, table.width)
}

/* Hand every column and row back. The writing stays on the cell it began in,
   which is where the eye last saw it. */
export function splitRect(table: Table, rect: Rect): Table {
  const grid = toGrid(table)
  const box = {
    top: Math.max(0, rect.top),
    bottom: Math.min(grid.height - 1, rect.bottom),
    left: Math.max(0, rect.left),
    right: Math.min(grid.columns - 1, rect.right),
  }
  const out: Block[] = []
  let changed = false
  for (const block of grid.blocks) {
    const hits =
      block.row <= box.bottom &&
      block.row + block.rows - 1 >= box.top &&
      block.column <= box.right &&
      block.column + block.span - 1 >= box.left
    if (!hits || (block.span === 1 && block.rows === 1)) {
      out.push(block)
      continue
    }
    changed = true
    for (let dr = 0; dr < block.rows; dr++) {
      for (let dc = 0; dc < block.span; dc++) {
        out.push({
          row: block.row + dr,
          column: block.column + dc,
          span: 1,
          rows: 1,
          text: dr === 0 && dc === 0 ? block.text : '',
        })
      }
    }
  }
  if (!changed) return table
  grid.blocks = out
  return fromGrid(grid, table.widths, table.aligns, table.width)
}

/* Clear the writing out of a rectangle without touching its shape. */
export function clearRect(table: Table, rect: Rect): Table {
  const grid = toGrid(table)
  let changed = false
  for (const block of grid.blocks) {
    const hits =
      block.row <= rect.bottom &&
      block.row + block.rows - 1 >= rect.top &&
      block.column <= rect.right &&
      block.column + block.span - 1 >= rect.left
    if (hits && block.text) {
      block.text = ''
      changed = true
    }
  }
  if (!changed) return table
  return fromGrid(grid, table.widths, table.aligns, table.width)
}

/* Put writing into the grid from a top-left corner, growing the table if what
   arrived is bigger than what is there. This is what a block pasted out of a
   spreadsheet lands through. */
export function writeBlock(table: Table, top: number, left: number, cells: string[][]): Table {
  let out = table
  const wantRows = top + cells.length
  const wantColumns = left + Math.max(...cells.map((r) => r.length), 0)
  while (rowCount(out) < wantRows) out = addRow(out, rowCount(out) - 1)
  while (columnCount(out) < wantColumns) out = addColumn(out, columnCount(out) - 1)

  const grid = toGrid(out)
  cells.forEach((row, dr) => {
    row.forEach((text, dc) => {
      const r = top + dr
      const c = left + dc
      const block = grid.blocks.find(
        (b) => b.row <= r && b.row + b.rows > r && b.column <= c && b.column + b.span > c,
      )
      /* Only the cell that begins at this position takes the writing — a
         merged cell reached at its second column is the same cell. */
      if (block && block.row === r && block.column === c) block.text = text
    })
  })
  return fromGrid(grid, out.widths, out.aligns, out.width)
}

export function setWidths(table: Table, widths: number[]): Table {
  return { ...table, widths }
}

export function setAlign(table: Table, from: number, to: number, align: Align): Table {
  const aligns = fitAligns(table.aligns ?? [], table.widths.length).slice()
  for (let c = Math.max(0, Math.min(from, to)); c <= Math.min(aligns.length - 1, Math.max(from, to)); c++) {
    aligns[c] = align
  }
  return { ...table, aligns }
}

/* The whole table, narrower or wider. The columns keep their shares of it, so
   pulling the table in doesn't rearrange what is inside it. */
export function setTableWidth(table: Table, width: number): Table {
  return { ...table, width: clampWidth(width) }
}

/* Where a cell sits in columns, so the widget can size and seam it. Rows
   above can push it along, so this asks the grid rather than counting spans
   along the row. */
export function columnOf(table: Table, row: number, index: number): number {
  const found = placement(table).find((p) => p.row === row && p.index === index)
  return found?.column ?? 0
}
