// A press that begins on a popover holds the popover still until it ends, so the
// click it produces lands on the control under the finger. It belongs to one
// pointer, never deletes anything itself, and always ends: on release (after a
// short wait for the click), cancel, capture lost before release, window blur,
// or a hard limit. dispose() drops it without running onEnd, for unmount and
// context changes.
export function createPress(onEnd: () => void) {
  let id: number | null = null, released = false, limit = 0, settle = 0
  const finish = (notify: boolean) => {
    if (id === null) return
    id = null
    clearTimeout(limit); clearTimeout(settle)
    document.removeEventListener('pointerup', up, true)
    document.removeEventListener('pointercancel', cancel, true)
    document.removeEventListener('lostpointercapture', lost, true)
    document.removeEventListener('click', click)
    window.removeEventListener('blur', blur)
    if (notify) onEnd()
  }
  const up = (e: PointerEvent) => { if (e.pointerId !== id) return; released = true; clearTimeout(settle); settle = window.setTimeout(() => finish(true), 400) }
  const cancel = (e: PointerEvent) => { if (e.pointerId === id) finish(true) }
  // Touch releases its implicit capture on every pointerup; only a loss before release ends the press.
  const lost = (e: PointerEvent) => { if (e.pointerId === id && !released) finish(true) }
  const click = () => { if (id !== null) window.setTimeout(() => finish(true), 0) }
  const blur = () => finish(true)
  return {
    start(e: {pointerId: number; isPrimary: boolean}) {
      if (id !== null || !e.isPrimary) return
      id = e.pointerId; released = false
      document.addEventListener('pointerup', up, true)
      document.addEventListener('pointercancel', cancel, true)
      document.addEventListener('lostpointercapture', lost, true)
      document.addEventListener('click', click)
      window.addEventListener('blur', blur)
      limit = window.setTimeout(() => finish(true), 2500)
    },
    active: () => id !== null,
    dispose: () => finish(false),
  }
}
