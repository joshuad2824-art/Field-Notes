import { useCallback, useSyncExternalStore } from 'react'

/* Three widths, as the visual system describes them.

   Phone: the page only, full bleed. Tablet: the leaf on the dark desk, with
   the sidebar a tap away rather than pinned. Desktop: the sidebar docked
   beside it. The leaf itself never widens past its measure at any of them —
   the page is a page, not a canvas that stretches. */

export const SIDEBAR_AVAILABLE = '(min-width: 820px)'
export const SIDEBAR_DOCKED = '(min-width: 1120px)'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )
  const value = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, value, () => false)
}
