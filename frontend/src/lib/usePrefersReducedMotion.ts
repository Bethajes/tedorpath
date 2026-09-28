import { useCallback, useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function matchQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

/**
 * Tracks the user's "reduce motion" preference from JavaScript.
 *
 * `index.css` already neutralises CSS animations and transitions for these
 * users, so this hook is only needed for motion CSS cannot stop — SVG attribute
 * writes driven by requestAnimationFrame, inline transforms, and the like.
 * Using it also lets a component skip the work instead of merely hiding it.
 */
export function usePrefersReducedMotion() {
  const subscribe = useCallback((onChange: () => void) => {
    const query = matchQuery()
    if (!query) return () => {}
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const getSnapshot = useCallback(() => matchQuery()?.matches ?? false, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
