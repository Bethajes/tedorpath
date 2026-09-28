import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls to the element named by the URL hash after navigation.
 *
 * In-page links such as `/#how-it-works` need this: the browser only honours a
 * hash on a full page load, so a client-side navigation to another route with a
 * hash would otherwise land at the top of the new page. The `requestAnimationFrame`
 * defers the scroll until the target section has been rendered.
 */
export function ScrollToHash() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      return
    }

    const id = hash.slice(1)
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])

  return null
}
