// Presentation only: count written checklist items, excluding code examples.
export function planProgress(body = '') {
  let fence: string | null = null, length = 0, total = 0, done = 0
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) { fence = marker[1][0]; length = marker[1].length }
      else if (fence === marker[1][0] && marker[1].length >= length) fence = null
      continue
    }
    if (fence) continue
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+\S/)
    if (item) { total++; if (item[1].toLowerCase() === 'x') done++ }
  }
  return { total, done }
}
