import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '@/core/icons'
import './Modal.css'

/** Native `<dialog>`, so focus trapping, the top layer and Escape come from the platform. */
export function Modal({
  title,
  children,
  footer,
  onClose,
  width = 520,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  width?: number
}) {
  const ref = useRef<HTMLDialogElement>(null)

  // Read through a ref: callers pass a fresh closure on every render, and this
  // effect closes the dialog on cleanup, so depending on it would blink the
  // modal shut and open again whenever the page behind it re-renders.
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
      className="modal"
      ref={ref}
      style={{ width }}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === ref.current) onClose()
      }}
    >
      <header className="modal__head">
        <h2 className="modal__title">{title}</h2>
        <button type="button" className="modal__close is-icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="modal__body scroll-y">{children}</div>
      {footer ? <footer className="modal__foot">{footer}</footer> : null}
    </dialog>
  )
}
