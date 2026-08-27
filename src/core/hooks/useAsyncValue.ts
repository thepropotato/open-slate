import { useEffect, useState } from 'react'

/**
 * Resolves an async value, keyed.
 *
 * Three properties matter here, and all three are easy to get wrong by hand:
 *  - state is only ever written from the async callback, so no render cascades;
 *  - a result whose key no longer matches is discarded, so switching inputs
 *    never shows the previous input's answer;
 *  - a `null` key means "don't load", and reads back as `null` immediately
 *    rather than after a clearing render.
 *
 * `key` is the cache identity by contract: whatever `load` closes over must be
 * reflected in it.
 */
export function useAsyncValue<T>(key: string | null, load: () => Promise<T | null>): T | null {
  const [resolved, setResolved] = useState<{ key: string; value: T | null } | null>(null)

  useEffect(() => {
    if (key === null) return
    let alive = true
    void load().then(
      (value) => {
        if (alive) setResolved({ key, value })
      },
      () => {
        if (alive) setResolved({ key, value: null })
      },
    )
    return () => {
      alive = false
    }
    // `load` is deliberately excluded: `key` is the identity of the request, so
    // including the closure would refetch on every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return resolved && resolved.key === key ? resolved.value : null
}
