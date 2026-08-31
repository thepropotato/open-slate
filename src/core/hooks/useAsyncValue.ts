import { useEffect, useState } from 'react'

/**
 * Resolves an async value, keyed. A stale result is discarded, and a `null` key
 * means "don't load" and reads back as `null` immediately.
 * `key` is the request identity by contract: whatever `load` closes over must be in it.
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
    // `load` excluded: `key` is the request identity, so including the closure refetches every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return resolved && resolved.key === key ? resolved.value : null
}
