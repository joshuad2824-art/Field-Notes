import { useRef } from 'react'

/* Held for half a second on a touch screen, or right-clicked on a desk. The
   tap that ends a long press must not also count as a tap, so the caller asks
   `fired()` in its click handler. */
export function useLongPress(run: () => void, ms = 500) {
  const timer = useRef(0)
  const done = useRef(false)
  const start = useRef<[number, number] | null>(null)
  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      done.current = false
      if (e.pointerType === 'mouse') return
      start.current = [e.clientX, e.clientY]
      timer.current = window.setTimeout(() => {
        done.current = true
        run()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const at = start.current
      if (at && Math.hypot(e.clientX - at[0], e.clientY - at[1]) > 8) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      cancel()
      done.current = false
      run()
    },
    fired: () => {
      const was = done.current
      done.current = false
      return was
    },
  }
}
