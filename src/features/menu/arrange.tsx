import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/core/icons/Icon'
import './arrange.css'

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

/** An exit that does not depend on where the page is scrolled to. */
export function ArrangeDone({ label, onDone }: { label: string; onDone: () => void }) {
  return createPortal(
    <button type="button" className="arrangedone" onClick={onDone}>
      <Icon name="check" />
      <span>{label}</span>
    </button>,
    document.body,
  )
}
