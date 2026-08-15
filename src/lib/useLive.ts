import { useEffect, useState } from 'react'
import { subscribe } from './db'

/* Re-runs a query whenever the store changes. The result is whatever the query
   returned last; there is no loading state on purpose — local reads land in a
   frame and a spinner would be slower than the data. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    let live = true
    const run = () => {
      query().then((v) => {
        if (live) setValue(v)
      })
    }
    run()
    const off = subscribe(run)
    return () => {
      live = false
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}
