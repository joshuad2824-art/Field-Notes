import { useEffect } from 'react'
import { sweepBlankPages } from './db'

/* Once for the app: clear away blank pages nobody is writing in, shortly after
   opening, every few minutes, and on coming back to the app. */
export function useBlankSweep() {
  useEffect(() => {
    const sweep = () => {
      if (document.visibilityState === 'visible') void sweepBlankPages().catch(() => {})
    }
    const first = window.setTimeout(sweep, 5000)
    const timer = window.setInterval(sweep, 3 * 60_000)
    document.addEventListener('visibilitychange', sweep)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sweep)
    }
  }, [])
}
