import { useCallback, useEffect, useState } from 'react'

import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Reports the first moment an element enters the viewport, then stops watching.
 *
 * This is the only motion on the site that needs JavaScript, and it is worth
 * keeping that small: a reveal is a transition between two static states, so
 * the hook does nothing but flip one boolean. It reveals on the *first*
 * intersection and disconnects, because a long page that re-animates its
 * content every time the reader scrolls back up reads as a slideshow rather
 * than as a page.
 *
 * Two cases skip the observer entirely and treat the element as in view from the
 * start:
 *
 *   - `prefers-reduced-motion: reduce`, so the reveal is not merely shortened
 *     but never runs. `index.css` collapses CSS durations globally, which would
 *     otherwise leave the element parked at its hidden end state.
 *   - No `IntersectionObserver` (older browser, or jsdom under test). Content
 *     that can never be revealed must not be content that is permanently
 *     invisible, so this fallback is always "visible".
 *
 * The returned `ref` is a callback rather than an object because the consumer
 * usually renders an intrinsic element picked at runtime (`li`, `section`, `p`),
 * and one callback satisfies all of them — a `RefObject<HTMLDivElement>` would
 * not.
 */
export function useInView(rootMargin = '0px 0px -12% 0px') {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [seen, setSeen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  /*
    Decided during render rather than inside the effect, so the hook contains no
    synchronous setState: a block that cannot animate is in view from the start,
    and that is a fact about the environment rather than an event to observe.
  */
  const instant = reducedMotion || typeof IntersectionObserver === 'undefined'

  const ref = useCallback((element: HTMLElement | null) => {
    setNode(element)
  }, [])

  useEffect(() => {
    if (!node || instant) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setSeen(true)
        observer.disconnect()
      },
      // Threshold 0 with a negative bottom margin: the element reveals as its
      // top edge comes into view, a little before it reaches the fold. A
      // fraction-based threshold would never fire for a block taller than the
      // viewport.
      { rootMargin, threshold: 0 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [node, instant, rootMargin])

  return { ref, inView: instant || seen }
}
