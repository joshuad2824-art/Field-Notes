/* Where a query appears in a page's text, as the writing reads — not inside
   what the leaf hides. A link's address, a colour's name, a line's alignment
   tag and a picture's file are in the stored text and never on the page, so a
   match there would be a mark on nothing. Case and accents don't matter.

   Pure and importable on node. */

export interface FindRange {
  from: number
  to: number
}

const HIDDEN = [
  /\]\([^)\n]*\)(?:\{[^}\n]*\})?/g, // a link's or a picture's destination, and a picture's placement
  /==\{\w+\}/g, // a highlighter's colour
  /^ *\{(?:center|right)\}/gm, // a line's alignment
  /^\{table \d{1,3}\}$/gm, // a table's width
  /<\/?u>/g, // underline
]

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function findRanges(text: string, query: string, limit = 2000): FindRange[] {
  const needle = fold(query.trim())
  if (!needle) return []
  /* Folding can change the length of a string; matching on a folded copy is
     only safe when it hasn't. */
  const folded = fold(text)
  const hay = folded.length === text.length ? folded : text.toLowerCase()
  const hidden: FindRange[] = []
  for (const pattern of HIDDEN) {
    for (const m of text.matchAll(pattern)) hidden.push({ from: m.index!, to: m.index! + m[0].length })
  }
  const out: FindRange[] = []
  let at = hay.indexOf(needle)
  while (at >= 0 && out.length < limit) {
    const to = at + needle.length
    if (!hidden.some((h) => at < h.to && to > h.from)) out.push({ from: at, to })
    at = hay.indexOf(needle, to)
  }
  return out
}
