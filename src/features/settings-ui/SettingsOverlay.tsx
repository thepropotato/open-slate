import { useCallback, useEffect, useRef } from 'react'
import { useClosing } from '@/core/hooks'
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
export function SettingsOverlay({
  initialSection,
  onClose,
  onClosing,
  onShown,
}: {
  initialSection?: string
  onClose: () => void
  /** Fires as the close animation starts, so the page can move back in step with the drawer. */
  onClosing?: () => void
  /** Fires once the drawer is on screen, so the page moves when the drawer does, not before. */
  onShown?: () => void
}) {
  const { closing, handleClose: startClose } = useClosing(onClose, 320)
  const handleClose = useCallback(() => {
    onClosing?.()
    startClose()
  }, [onClosing, startClose])
  const ref = useRef<HTMLDialogElement>(null)

  // Read through a ref: the caller passes a fresh closure on every render, and
  // this effect closes the dialog on cleanup, so depending on it would blink the
  // panel shut and open again on each edit.
  const close = useRef(handleClose)
  useEffect(() => {
    close.current = handleClose
  }, [handleClose])

  const shown = useRef(onShown)
  useEffect(() => {
    shown.current = onShown
  }, [onShown])

  // Opens once, on mount, and closes once, on unmount.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    shown.current?.()
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
      data-closing={closing || undefined}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === ref.current) handleClose()
      }}
    >
      <SettingsPanel layout="drawer" initialSection={initialSection} onClose={handleClose} />
    </dialog>
  )
}
