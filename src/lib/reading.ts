import { isTableAttr, parseTable, type Table } from './table.ts'

// Read-only structure. Saved Markdown remains the source of truth.
export type ReadingBlock = (
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; text: string; language: string }
  | { kind: 'rule' }
  | { kind: 'quote'; blocks: ReadingBlock[] }
  | { kind: 'list'; ordered: boolean; start: number; items: { checked?: boolean; blocks: ReadingBlock[] }[] }
  | { kind: 'table'; head: string[]; rows: string[][]; table: Table | null }
  | { kind: 'image'; id: string; caption: string }
) & { align?: 'center' | 'right' }

const heading = /^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/
const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/
const item = /^(\s*)([-+*]|\d+[.)])\s+(.*)$/
const rule = /^\s{0,3}(?:\*\s*){3,}$|^\s{0,3}(?:-\s*){3,}$|^\s{0,3}(?:_\s*){3,}$/
const image = /^\s*!\[([^\]]*)\]\(images\/([\w-]+)\.[\w]+\)(?:\{[^}]*\})?\s*$/
function cells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))
}
function tableStart(lines: string[], at: number) {
  return lines[at]?.includes('|') && lines[at + 1]?.includes('|') && cells(lines[at + 1]).every(cell => /^:?-{3,}:?$/.test(cell))
}
function startsBlock(lines: string[], at: number) {
  const line = lines[at]
  return !line?.trim() || heading.test(line) || fence.test(line) || item.test(line) || rule.test(line) || /^\s*>/.test(line) || image.test(line) || /^\{(center|right)\}/.test(line) || tableStart(lines, at) || (isTableAttr(line) && tableStart(lines, at + 1))
}

export function readingBlocks(text: string): ReadingBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n'), blocks: ReadingBlock[] = []
  for (let at = 0; at < lines.length;) {
    const aligned = lines[at].match(/^\{(center|right)\}/)
    const line = aligned ? lines[at].slice(aligned[0].length) : lines[at]
    lines[at] = line
    if (!line.trim()) { at++; continue }
    const fenced = line.match(fence), title = line.match(heading), picture = line.match(image), first = line.match(item)
    if (fenced) {
      const content: string[] = [], marker = fenced[1][0], length = fenced[1].length
      at++
      while (at < lines.length && !new RegExp(`^\\s{0,3}${marker}{${length},}\\s*$`).test(lines[at])) content.push(lines[at++])
      if (at < lines.length) at++
      blocks.push({ kind: 'code', text: content.join('\n'), language: fenced[2].trim() })
    } else if (title) { blocks.push({ kind: 'heading', level: title[1].length, text: title[2] }); at++ }
    else if (picture) { blocks.push({ kind: 'image', caption: picture[1], id: picture[2] }); at++ }
    else if (rule.test(line)) { blocks.push({ kind: 'rule' }); at++ }
    else if (tableStart(lines, at) || (isTableAttr(line) && tableStart(lines, at + 1))) {
      const source: string[] = []
      if (isTableAttr(line)) source.push(lines[at++])
      const head = cells(lines[at]), rows: string[][] = []; source.push(lines[at++], lines[at++])
      while (at < lines.length && lines[at].trim() && lines[at].includes('|')) { source.push(lines[at]); rows.push(cells(lines[at++])) }
      blocks.push({ kind: 'table', head, rows, table: parseTable(source) })
    } else if (/^\s*>/.test(line)) {
      const content: string[] = []
      while (at < lines.length && /^\s*>/.test(lines[at])) content.push(lines[at++].replace(/^\s*> ?/, ''))
      blocks.push({ kind: 'quote', blocks: readingBlocks(content.join('\n')) })
    } else if (first) {
      const indent = first[1].length, ordered = /^\d/.test(first[2]), items: { checked?: boolean; blocks: ReadingBlock[] }[] = []
      while (at < lines.length) {
        const next = lines[at].match(item)
        if (!next || next[1].length !== indent || /^\d/.test(next[2]) !== ordered) break
        const check = next[3].match(/^\[([ xX])\]\s+(.*)$/), content = [check ? check[2] : next[3]]
        at++
        while (at < lines.length) {
          if (!lines[at].trim()) {
            if (lines[at + 1] && /^\s+\S/.test(lines[at + 1]) && lines[at + 1].match(/^\s*/)![0].length > indent) { content.push(''); at++; continue }
            break
          }
          const leading = lines[at].match(/^\s*/)![0].length
          if (leading <= indent) break
          content.push(lines[at++].slice(Math.min(leading, indent + next[2].length + 1)))
        }
        items.push({ checked: check ? check[1].toLowerCase() === 'x' : undefined, blocks: readingBlocks(content.join('\n')) })
        if (!lines[at]?.trim() && lines[at + 1]?.match(item)?.[1].length === indent) at++
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items })
    } else {
      const content = [line]; at++
      while (at < lines.length && !startsBlock(lines, at)) content.push(lines[at++])
      blocks.push({ kind: 'paragraph', text: content.join('\n') })
    }
    if (aligned && blocks.length) blocks[blocks.length - 1].align = aligned[1] as 'center' | 'right'
  }
  return blocks
}

export function safeReadingUrl(url: string): string | null {
  const value = url.trim()
  if (/^(?:https?:\/\/|mailto:)/i.test(value) || /^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value)) return value
  return null
}

export type PlanSection = { id: string; title: string; blocks: ReadingBlock[]; role: 'overview' | 'measurements' | 'materials' | 'build' | 'references' }
function sectionRole(title: string): PlanSection['role'] {
  if (/cut|dimension|measure|size|layout/i.test(title)) return 'measurements'
  if (/material|suppl|tool|hardware/i.test(title)) return 'materials'
  if (/reference|source|revision|earlier|appendix/i.test(title)) return 'references'
  if (/build|assembl|phase|step|construct|finish/i.test(title)) return 'build'
  return 'overview'
}
export function planReading(body: string, title: string) {
  const blocks = readingBlocks(body)
  const metadata: Record<string, string> = {}
  // Only move the opening metadata, never matching prose or code later in a plan.
  while (blocks.length) {
    const first = blocks[0]
    if (first.kind === 'heading' && first.level === 1 && first.text === title) { blocks.shift(); continue }
    if (first.kind !== 'paragraph') break
    const lines = first.text.split('\n'), remaining: string[] = []
    let consumed = true
    for (const line of lines) {
      const detail = line.match(/^(?:\*\*)?(Project|Version|Owner|Where we left off|Next step):(?:\*\*)?\s*(.*)$/i)
      if (consumed && /^\s*(?:#[\w-]+\s*)+$/.test(line)) continue
      if (consumed && detail) { metadata[detail[1].toLowerCase()] = detail[2]; continue }
      consumed = false; remaining.push(line)
    }
    if (remaining.length === lines.length) break
    blocks.shift()
    if (remaining.length) { blocks.unshift({ kind: 'paragraph', text: remaining.join('\n') }); break }
  }
  const sections: PlanSection[] = []
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level <= 2) {
      sections.push({ id: `plan-section-${sections.length + 1}`, title: block.text, role: sectionRole(block.text), blocks: [] })
    } else {
      if (!sections.length) sections.push({ id: 'plan-section-1', title: 'Overview', role: 'overview', blocks: [] })
      sections[sections.length - 1].blocks.push(block)
    }
  }
  return { metadata, sections }
}

export function decorationFor(id: string) {
  let hash = 2166136261
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) % 9
}

/* A stable mixed stack of papers, with a different shuffle for each group.
   Neighboring cards never share the same corner treatment. */
export function planPapers(id: string, titles: string[]) {
  let lastPaper = -1, lastDecoration = -1
  let bag: number[] = []
  return titles.map((title, index) => {
    if (!bag.length) {
      const group = Math.floor(index / 5)
      bag = [0,1,2,3,4].sort((a,b) => decorationFor(`${id}:${group}:paper:${a}`) - decorationFor(`${id}:${group}:paper:${b}`) || a-b)
      if (bag[0] === lastPaper) [bag[0],bag[1]] = [bag[1],bag[0]]
    }
    const paper = bag.shift()!
    let decoration = decorationFor(`${id}:${index}:${title}`) % 4
    if (decoration === lastDecoration) decoration = (decoration + 1 + decorationFor(`${title}:cut`) % 3) % 4
    lastPaper = paper; lastDecoration = decoration
    return { paper, decoration }
  })
}
