import { useEffect, useState } from 'react'

/**
 * A ticking clock that only wakes as often as it needs to.
 *
 * Timeouts are aligned to the next boundary rather than fired every N ms, so a
 * minute-precision widget updates exactly when the minute changes and stays
 * asleep in between. Without alignment a clock drifts and can show the wrong
 * minute for most of a second.
 */
export function useNow(precision: 'second' | 'minute' = 'minute'): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      const current = new Date()
      const step = precision === 'second' ? 1000 : 60_000
      const delay = step - (current.getTime() % step)
      timer = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, delay + 15)
    }

    // A tab that was hidden for hours must not show a stale time on return.
    const onVisible = () => {
      if (!document.hidden) setNow(new Date())
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [precision])

  return now
}
