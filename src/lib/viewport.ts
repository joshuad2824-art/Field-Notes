/* iOS scrolls the whole document when the keyboard opens under a focused
   editable, which drags the app's own top bar off the screen — the page ends
   up under the status bar and the formatting row is gone. `overflow: hidden`
   does not stop it; only a body that cannot scroll does.

   So: the body is fixed, and the app is sized to the visual viewport rather
   than the layout viewport, which means the leaf ends exactly where the
   keyboard begins instead of hiding behind it. `interactive-widget=
   resizes-content` in the viewport meta does this on its own where it's
   supported; this is the floor under it. */

export function trackViewport(): void {
  const root = document.documentElement
  const vv = window.visualViewport

  const apply = () => {
    const height = vv ? vv.height : window.innerHeight
    root.style.setProperty('--app-height', `${Math.round(height)}px`)
    /* Undo any scroll iOS performed on our behalf. */
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
  }

  apply()

  if (vv) {
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
  }
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  /* Focus moves are when iOS is most likely to scroll us. */
  window.addEventListener('focusin', apply)
  document.addEventListener('scroll', apply, { passive: true })
}
