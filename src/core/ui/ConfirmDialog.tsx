import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './controls'
import type { IconName } from '@/core/icons'

/**
 * Gate in front of anything that destroys data. Deliberately plain: the
 * dialog states what will be lost and makes the destructive choice the one
 * the user has to reach for, not the one under the cursor.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmIcon = 'remove',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  confirmIcon?: IconName
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      width={420}
      onClose={onCancel}
      footer={
        <>
          <span className="modal__spacer" />
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" icon={confirmIcon} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="confirm__body">{body}</p>
    </Modal>
  )
}
