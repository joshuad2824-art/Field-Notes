import { useSyncExternalStore } from 'react'

/* iOS moves the app out from under itself when the keyboard opens, and it has
   two ways of doing it.

   The first is scrolling the document, which a fixed body stops. The second is
   scrolling the *visual* viewport, which it doesn't — the body stays where it
   was pinned and the top of the app ends up above the visible area, taking the
   tools row with it. `visualViewport.offsetTop` is how far it has been moved,
   so the app is positioned at that offset and sized to `visualViewport.height`.
   The result: the app covers exactly what can be seen, with the leaf ending
   where the keyboard begins. */

const KEYBOARD_THRESHOLD = 120

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

    root.style.setProperty('--app-height', `${Math.round(height)}px`)
    root.style.setProperty('--app-top', `${Math.round(top)}px`)

    const open = window.innerHeight - height > KEYBOARD_THRESHOLD
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
