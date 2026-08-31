import { useEffect, useState } from 'react'

/**
 * Trails `value` by `delay`, so a per-keystroke value can key work that should
 * only run once typing settles. A falsy value reads back at once, so clearing a
 * box never leaves stale output up for the length of the delay.
 */
export function useDebounced<T>(value: T, delay = 150): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    if (!value) return
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return value ? settled : value
}
