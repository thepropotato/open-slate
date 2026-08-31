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

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const onCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.close()
    }
  }, [onClose])

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
