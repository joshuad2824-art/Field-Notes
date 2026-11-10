import { useRef, type TouchEvent } from 'react'

/* CodeMirror scrolls inside the web view. Observe its downward gesture without
   cancelling scrolling or changing the editor's selection. */
export function useNativeKeyboardDismissGesture(enabled: boolean, dismiss: () => void) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null)
  const reset = () => { start.current = null }
  return {
    onTouchStartCapture(event: TouchEvent<HTMLElement>) {
      reset()
      if (!enabled || event.touches.length !== 1 || !(event.target instanceof Element) || !event.target.closest('.editor')) return
      const touch = event.touches[0]
      start.current = { x: touch.clientX, y: touch.clientY, at: performance.now() }
    },
    onTouchMoveCapture(event: TouchEvent<HTMLElement>) {
      const origin = start.current
      if (!enabled || !origin || event.touches.length !== 1) { reset(); return }
      const touch = event.touches[0], dx = Math.abs(touch.clientX - origin.x), dy = touch.clientY - origin.y
      if (performance.now() - origin.at > 700 || dy < -12 || dx > Math.max(20, Math.abs(dy))) { reset(); return }
      if (dy >= 44 && dy > dx * 1.5) { reset(); dismiss() }
    },
    onTouchEndCapture: reset,
    onTouchCancelCapture: reset,
  }
}
