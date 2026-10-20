import { useEffect, useState } from 'react'
import { allSienaItems } from './siena-items'
import { useLive } from './useLive'

// Time-based Archive membership also refreshes while a screen stays open.
export function useSienaItems() {
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setMinute(value => value + 1), 60000)
    return () => clearInterval(timer)
  }, [])
  return useLive(allSienaItems, [minute], [])
}
