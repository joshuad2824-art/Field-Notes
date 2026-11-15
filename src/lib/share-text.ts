/* A page as someone else will read it (November 2026).

   Sharing from the phone hands a page to Messages, Mail or Notes, none of
   which read this app's markdown — and the syntax is never shown (decision 5),
   so sending it out raw would show it somewhere else instead. What goes out is
   the page as it reads on the leaf: no #, no **, no colour tags, no alignment
   tags, a checklist as ☐ and ☑, a list as •, a link as its words with the
   address after them, a table as rows of cells.

   Pure, and importable on node, so the rules are checked without a browser. */

function inline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)(?:\{[^}]*\})?/g, '$1')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) =>
      label.trim() === url ? url : `${label} (${url})`)
    .replace(/==(?:\{\w+\})?([^=]+)==/g, '$1')
    .replace(/<u>([^<>]+)<\/u>/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
}

function tableRow(line: string): string | null {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells = inner.split('|').map((cell) => cell.trim())
  /* The delimiter row is structure, not writing. */
  if (cells.every((cell) => /^:?-{1,}:?$/.test(cell))) return null
  const words = cells
    .filter((cell) => !/^[<^]$/.test(cell))
    .map((cell) => inline(cell.replace(/^\\([<^])$/, '$1')))
    .filter(Boolean)
  return words.length ? words.join('  ·  ') : null
}

export function readableText(body: string): string {
  const out: string[] = []
  for (const raw of body.split('\n')) {
    if (/^\{table \d{1,3}\}$/.test(raw.trim())) continue
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      const row = tableRow(raw)
      if (row) out.push(row)
      continue
    }
    const indent = raw.match(/^ */)![0]
    let line = raw.slice(indent.length).replace(/^\{(center|right)\}/, '')
    /* A picture on its own line reads as its caption, or as nothing. */
    if (/^!\[[^\]]*\]\([^)]*\)(?:\{[^}]*\})?$/.test(line)) {
      const caption = line.match(/^!\[([^\]]*)\]/)![1].trim()
      if (caption) out.push(indent + caption)
      continue
    }
    let prefix = ''
    const heading = line.match(/^#{1,3}\s+/)
    const task = line.match(/^[-*]\s\[([ xX])\]\s/)
    const bullet = line.match(/^[-*]\s/)
    const number = line.match(/^(\d+)\.\s/)
    const quote = line.match(/^>\s?/)
    if (heading) line = line.slice(heading[0].length)
    else if (task) {
      prefix = task[1] === ' ' ? '☐ ' : '☑ '
      line = line.slice(task[0].length)
    } else if (bullet) {
      prefix = '• '
      line = line.slice(bullet[0].length)
    } else if (number) {
      prefix = `${number[1]}. `
      line = line.slice(number[0].length)
    } else if (quote) {
      prefix = '│ '
      line = line.slice(quote[0].length)
    }
    out.push(indent + prefix + inline(line).trimEnd())
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
