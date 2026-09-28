import type { EditorView } from '@codemirror/view'

/* Links stay in the page's existing Markdown body. No page or sync conversion is
   needed, and a URL already written as plain text is never rewritten. */
export interface NoteLink {
  from: number
  to: number
  labelFrom: number
  labelTo: number
  label: string
  url: string
}

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g

export function safeLinkUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    /* A literal closing parenthesis would close the Markdown destination. */
    return url.href.replace(/\(/g, '%28').replace(/\)/g, '%29')
  } catch {
    return null
  }
}

export function linksIn(text: string, base = 0): NoteLink[] {
  const links: NoteLink[] = []
  for (const match of text.matchAll(LINK)) {
    const start = match.index
    if (start > 0 && text[start - 1] === '!') continue // a picture
    if (!safeLinkUrl(match[2])) continue
    const from = base + start
    const labelFrom = from + 1
    const labelTo = labelFrom + match[1].length
    links.push({ from, to: from + match[0].length, labelFrom, labelTo, label: match[1], url: match[2] })
  }
  return links
}

export function linkAt(view: EditorView): NoteLink | null {
  const { from, to } = view.state.selection.main
  return linksIn(view.state.doc.toString()).find(link =>
    from >= link.from && to <= link.to && (from <= link.labelTo || from === to),
  ) ?? null
}

export function writeLink(
  view: EditorView,
  range: { from: number; to: number },
  label: string,
  url: string,
  existing: NoteLink | null,
): string | null {
  const destination = safeLinkUrl(url)
  if (!destination) return 'Enter a complete http or https URL.'
  if (!label.trim()) return 'Enter link text.'
  if (/[\[\]\n]/.test(label)) return 'Link text cannot contain brackets or a line break.'
  const from = existing?.from ?? range.from
  const to = existing?.to ?? range.to
  if (from < 0 || to > view.state.doc.length) return 'Select the text again.'
  const insert = `[${label}](${destination})`
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + 1, head: from + 1 + label.length } })
  view.focus()
  return null
}

export function removeLink(view: EditorView, link: NoteLink): void {
  view.dispatch({
    changes: { from: link.from, to: link.to, insert: link.label },
    selection: { anchor: link.from, head: link.from + link.label.length },
  })
  view.focus()
}
