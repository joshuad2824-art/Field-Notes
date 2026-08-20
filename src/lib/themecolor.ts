/* What the system paints where the app isn't.

   Installed on an iPad, the web view is not always given the whole screen —
   measured on a real device, 712pt of an available 744. Everything inside the
   viewport is ours and covered; the strip outside it is painted by the system,
   and the rule here is that it should be whatever is actually at the bottom of
   the screen. A night page makes it teal-900, a cream page makes it cream, the
   list and the calendar make it the frame's own teal. The strip stops reading
   as a band because it stops being a different colour.

   **Where that colour comes from was wrong for a release, and this is the
   correction.** It was `<meta name="theme-color">`, and the meta was being set
   perfectly and changing nothing: the strip is the CSS *canvas*, and the canvas
   background comes from `html`, or from `body` when `html` hasn't got one. Ours
   hadn't, so `body`'s frame teal propagated up and got painted across the whole
   window — the same #142a2b under every screen, whatever the meta said. It went
   unnoticed on the iPad because the frame teal is what the strip was supposed to
   be there. It shows on a phone the moment a page's own stock is anything else,
   which is a cream leaf sitting on a teal band.

   So both are set. The canvas is the one that does the work; the meta is still
   right for the browsers that use it, and costs a string. */

const FALLBACK = '#142A2B'

function tag(): HTMLMetaElement | null {
  return document.querySelector('meta[name="theme-color"]')
}

/* What we last asked for, rather than what the element reports — the DOM hands
   back `rgb(20, 42, 43)` for a hex that went in, so comparing against it would
   repaint on every read. */
let painted = ''

export function setEdgeColor(color: string): void {
  const next = color.trim() || FALLBACK
  if (next === painted) return
  painted = next

  /* The canvas. `html` before `body`, so this is the one that propagates. */
  document.documentElement.style.backgroundColor = next

  const meta = tag()
  if (meta && meta.content !== next) meta.content = next
}

/* Read a token rather than repeating a hex here — the palette lives in
   tokens.css and there should be one copy of it. */
export function tokenColor(name: string, from: Element = document.documentElement): string {
  return getComputedStyle(from).getPropertyValue(name).trim() || FALLBACK
}

export function resetEdgeColor(): void {
  setEdgeColor(tokenColor('--frame-bg'))
}

/* An element's background as it actually *appears*, which is not what
   `getComputedStyle` reports: it gives back the colour that was asked for,
   alpha and all, and a translucent bar over the frame lands somewhere else
   entirely. The list's foot is `rgba(5, 27, 28, .92)` and arrives at roughly
   #061c1d — near enough black, and nothing like the frame's own teal.

   That gap is one of the two bugs this file exists to close. The strip the
   system keeps below the app should be whatever is at the bottom of the
   screen. On a page that is the leaf. On the list it is this foot, and calling
   it the frame's teal put a visibly lighter band under a nearly black bar. */
export function surfaceColor(el: Element): string {
  const front = parseColor(getComputedStyle(el).backgroundColor)
  if (!front) return tokenColor('--frame-bg')
  const [r, g, b, a] = front
  if (a >= 0.999) return toHex(r, g, b)
  const back = parseColor(tokenColor('--frame-bg')) ?? [20, 42, 43, 1]
  return toHex(r * a + back[0] * (1 - a), g * a + back[1] * (1 - a), b * a + back[2] * (1 - a))
}

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba | null {
  const text = value.trim()
  const fn = text.match(/^rgba?\(([^)]+)\)$/i)
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!hex) return null
  const digits =
    hex[1].length === 3
      ? hex[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : hex[1]
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
    1,
  ]
}

function toHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}
