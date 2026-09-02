import { useEffect, useRef } from 'react'
import { SettingsPanel } from './SettingsPanel'
import './SettingsOverlay.css'

/**
 * The settings panel as a full-bleed popover over the page it edits, so opening
 * settings does not navigate away from the new tab. Native `<dialog>`, so focus
 * trapping, the top layer and Escape come from the platform.
 *
 * `options.html` still mounts the same `SettingsPanel` directly: Chrome's own
 * "Extension options" menu can only open a page.
 */
export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  // Read through a ref: the caller passes a fresh closure on every render, and
  // this effect closes the dialog on cleanup, so depending on it would blink the
  // panel shut and open again on each edit.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  // Opens once, on mount, and closes once, on unmount.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const onCancel = (event: Event) => {
      event.preventDefault()
      close.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.close()
    }
  }, [])

  return (
    <dialog
      className="settings-overlay"
      ref={ref}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === ref.current) onClose()
      }}
    >
      <SettingsPanel onClose={onClose} />
    </dialog>
  )
}
