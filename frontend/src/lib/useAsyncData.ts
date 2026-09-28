import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Loads data from the API and tracks loading/error state.
 *
 * The fetch is driven by `deps`: change them and the data reloads. This exists
 * so the admin screens share one implementation instead of repeating the same
 * effect, and so a stale response can never overwrite newer state.
 *
 * `mapError` turns an ApiError into the message the operator should read.
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  mapError: (error: unknown) => string,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const loadRef = useRef(load)
  loadRef.current = load
  const mapErrorRef = useRef(mapError)
  mapErrorRef.current = mapError

  useEffect(() => {
    let cancelled = false

    // Fetching in an effect is synchronising with an external system (our API),
    // which is what effects are for; `loading` starts as true so no extra
    // render is needed on the first pass.
    setLoading(true)
    setError(null)

    loadRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(mapErrorRef.current(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data, loading, error, reload }
}
