import { useSyncExternalStore } from 'react'

/* iOS moves the app out from under itself when the keyboard opens, and it has
   two ways of doing it.

   The first is scrolling the document, which a fixed body stops. The second is
   scrolling the *visual* viewport, which it doesn't — the body stays where it
   was pinned and the top of the app ends up above the visible area, taking the
   tools row with it. `visualViewport.offsetTop` is how far it has been moved,
   so the app is positioned at that offset and sized to `visualViewport.height`.
   The result: the app covers exactly what can be seen, with the leaf ending
   where the keyboard begins.

   That is the right answer while a keyboard is up and the wrong one the rest
   of the time. Installed on iPadOS, `visualViewport.height` stops short of
   the home indicator while `window.innerHeight` does not, so sizing to it
   leaves a strip of the frame — lantern wash and all — showing under the
   bottom of the app. An iPhone doesn't do this, which is why it only ever
   turned up on the tablet. With no keyboard there is nothing to duck, so an
   installed app takes the whole window and the strip has nowhere to be. In a
   browser we keep ducking, because there the short viewport is Safari's own
   toolbar and running under it would hide the foot of the list. */

const KEYBOARD_THRESHOLD = 120

function installed(): boolean {
  const asApp = window.matchMedia?.('(display-mode: standalone)').matches
  /* iOS Safari predates display-mode and still answers this one. */
  const legacy = (window.navigator as { standalone?: boolean }).standalone === true
  return asApp === true || legacy
}

let keyboardOpen = false
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function trackViewport(): void {
  const root = document.documentElement
  const vv = window.visualViewport

  const apply = () => {
    const height = vv ? vv.height : window.innerHeight
    const top = vv ? vv.offsetTop : 0
    const open = window.innerHeight - height > KEYBOARD_THRESHOLD

    /* With no keyboard to duck, don't measure at all — hand the height back to
       CSS, which falls through to 100dvh. Any pixel count we work out here can
       come up short by whatever the device decides not to tell us, and a short
       app leaves the frame showing under it. `dvh` is the browser's own answer
       to that question and it can't disagree with itself. */
    const whole = installed() && !open
    if (whole) {
      root.style.removeProperty('--app-height')
      root.style.removeProperty('--app-top')
    } else {
      root.style.setProperty('--app-height', `${Math.round(height)}px`)
      root.style.setProperty('--app-top', `${Math.round(top)}px`)
    }

    if (open !== keyboardOpen) {
      keyboardOpen = open
      emit()
    }

    /* Undo any document scroll iOS performed on our behalf. */
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
  }

  apply()

  if (vv) {
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
  }
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  /* Focus moves are when iOS is most likely to move us. */
  window.addEventListener('focusin', apply)
  window.addEventListener('focusout', apply)
  document.addEventListener('scroll', apply, { passive: true })
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function snapshot() {
  return keyboardOpen
}

/* True while a soft keyboard is taking up the bottom of the screen. */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
