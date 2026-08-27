import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '@/core/icons'
import './Modal.css'

/**
 * Centred dialog. Uses the native `<dialog>` element so focus trapping, the
 * top layer and Escape handling come from the platform rather than from us.
 */
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
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="modal__body scroll-y">{children}</div>
      {footer ? <footer className="modal__foot">{footer}</footer> : null}
    </dialog>
  )
}
