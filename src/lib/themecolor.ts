/* What iOS paints where the app isn't.

   Installed on an iPad, the web view is not always given the whole screen —
   measured on a real device, 712pt of an available 744. Everything inside the
   viewport is ours and covered; the strip outside it is the system's, and the
   system fills it from `<meta name="theme-color">`.

   So rather than trying to grow the app into a place it cannot reach, the
   theme colour follows whatever is actually at the bottom of the screen. A
   night page makes it teal-900, a cream page makes it cream, the list and the
   calendar make it the frame's own teal. The strip stops being a band because
   it stops being a different colour. */

const FALLBACK = '#142A2B'

function tag(): HTMLMetaElement | null {
  return document.querySelector('meta[name="theme-color"]')
}

export function setThemeColor(color: string): void {
  const meta = tag()
  if (!meta) return
  const next = color.trim() || FALLBACK
  /* Setting it to what it already is makes Safari repaint the strip, which
     reads as a flicker at the bottom of the screen. */
  if (meta.content !== next) meta.content = next
}

/* Read a token rather than repeating a hex here — the palette lives in
   tokens.css and there should be one copy of it. */
export function tokenColor(name: string, from: Element = document.documentElement): string {
  return getComputedStyle(from).getPropertyValue(name).trim() || FALLBACK
}

export function resetThemeColor(): void {
  setThemeColor(tokenColor('--frame-bg'))
}
