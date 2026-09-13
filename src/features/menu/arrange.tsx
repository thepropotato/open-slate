import { useEffect } from 'react'

/**
 * Escape leaves arrange mode. Capture, so it runs before the palette and the
 * settings dialog, but only while arranging - otherwise it would swallow the
 * key from whatever else wants it.
 */
export function useArrangeEscape(active: boolean, done: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      done()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, done])
}
