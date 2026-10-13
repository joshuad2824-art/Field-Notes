import { useEffect, useRef } from 'react'

/* Escape closes whatever opened last, and nothing else. Every menu, tray,
   popover and sheet registers here while it is open; the key is taken before
   the editor or the frame sees it, so the order is always: the open thing,
   then the editor's focus, then up. */
const stack: { current: () => void }[] = []

window.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Escape' || !stack.length || e.isComposing) return
    e.preventDefault()
    e.stopPropagation()
    stack[stack.length - 1].current()
  },
  true,
)

export function useDismiss(open: boolean, close: () => void) {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open) return
    const entry = { current: () => latest.current() }
    stack.push(entry)
    return () => {
      const at = stack.indexOf(entry)
      if (at >= 0) stack.splice(at, 1)
    }
  }, [open])
}

export function somethingOpen() {
  return stack.length > 0
}

/* Up from an open sheet is the view under it, so ← closes before it leaves. */
export function closeTop(): boolean {
  if (!stack.length) return false
  stack[stack.length - 1].current()
  return true
}
