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
   of the time, for anything. `visualViewport.height` stops short of whatever
   the browser is holding back — the home indicator on an installed iPad,
   Safari's own toolbar in a tab — and sizing the app to it leaves a strip of
   the frame showing along the bottom of the screen, lantern wash and all.
   That strip is the bar. It was closed for an installed app first and left
   open in a browser deliberately, so the foot of the list wouldn't hide under
   Safari's toolbar; it was still a band on the phone, which is a worse thing
   to look at every day than a New page button that needs the toolbar tapped
   away.

   So with no keyboard up, nothing is measured anywhere: the app is the body
   and the body is the screen. What the browser overlays at the bottom is
   handed to CSS as `--browser-bottom` instead, and `--safe-bottom` takes
   whichever of that and the home indicator is deeper. The foot pads itself
   clear of the toolbar; its background still runs to the very bottom edge. */

const KEYBOARD_THRESHOLD = 120

/* The browser's own furniture along the bottom — Safari's toolbar, and
   nothing at all in an installed app. Capped, because a number this far out
   is a misreading rather than a toolbar, and padding a foot by half the
   screen would be worse than the band. */
const MAX_OVERLAY = 160

/* A strip below the app deeper than this is not a strip — it is `screen.height`
   still answering in portrait while the device is on its side. */
const MAX_OUTSIDE = 120

let keyboardOpen = false
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function trackViewport(): void {
  const root = document.documentElement
  const vv = window.visualViewport

  /* `apply` runs on scroll, so writing a property that hasn't changed would
     be a style recalculation for nothing, on the one event that can least
     afford one. */
  const set = (name: string, value: string) => {
    if (root.style.getPropertyValue(name) === value) return
    root.style.setProperty(name, value)
  }
  const clear = (name: string) => {
    if (root.style.getPropertyValue(name) !== '') root.style.removeProperty(name)
  }

  const apply = () => {
    const height = vv ? vv.height : window.innerHeight
    const top = vv ? vv.offsetTop : 0
    const open = window.innerHeight - height > KEYBOARD_THRESHOLD

    /* With no keyboard to duck, don't measure at all — hand the height back
       to CSS, where `#root` is pinned to the bottom of a body that is already
       exactly the screen. Any pixel count worked out here can come up short
       by whatever the device decides not to tell us, and a short app is the
       band. */
    if (open) {
      set('--app-height', `${Math.round(height)}px`)
      set('--app-top', `${Math.round(top)}px`)
      /* The app is the visible region exactly, so there is nothing overlaying
         its foot — and the foot isn't on screen with a keyboard up anyway. */
      set('--browser-bottom', '0px')
    } else {
      clear('--app-height')
      clear('--app-top')
      const overlay = window.innerHeight - height - top
      set('--browser-bottom', `${Math.max(0, Math.min(MAX_OVERLAY, Math.round(overlay)))}px`)

      /* And how much of the screen is below the app entirely. An installed app
         that covers the status bar is handed the screen less the status bar —
         894 of 956 on a phone, 712 of 744 on an iPad — and the leftover is at
         the foot. iOS reports a bottom inset anyway, for an indicator sitting
         in that leftover rather than over us, and padding for it puts a wide
         empty band under the page foot.

         Capped at MAX_OUTSIDE because in landscape `screen.height` keeps
         reporting the portrait figure, so the subtraction is meaningless and
         hundreds of pixels wide; past that it is a misreading and the inset is
         left to stand on its own. */
      const outside = window.screen.height - window.innerHeight
      set('--outside-bottom', outside > 0 && outside <= MAX_OUTSIDE ? `${Math.round(outside)}px` : '0px')
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
