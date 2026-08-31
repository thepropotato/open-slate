import { useEffect, useState } from 'react'

/** Ticking clock. Timeouts align to the next boundary rather than firing every N ms, which would drift. */
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
