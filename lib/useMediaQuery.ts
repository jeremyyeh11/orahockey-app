'use client'

import { useSyncExternalStore } from 'react'

/** Matches Tailwind's `lg` breakpoint — where the app switches to its desktop layout. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * Live `window.matchMedia` result. Renders `false` on the server, so only use it
 * where a touch-first first paint is acceptable (or the component mounts client-side).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
