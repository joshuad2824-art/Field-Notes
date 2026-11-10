import { useEffect, useRef, useState } from 'react'

/* Whether a scroller has more below what shows. The app draws no scrollbars
   (October 14), so a tile that holds more than it shows says so with a soft
   fade at its foot instead — `has-more` in daily.css — which goes away once
   it is scrolled to the end. `key` is anything that changes when the content
   does. */
export function useOverflow<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [key])
  return [ref, more] as const
}
