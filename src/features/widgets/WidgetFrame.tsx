import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/core/icons'

/**
 * Chrome around a widget: the surface, and the controls that only appear while
 * the canvas is unlocked. The drag handle is deliberately a small grip rather
 * than the whole widget, so a widget with its own inputs stays usable.
 */
export function WidgetFrame({
  title,
  icon,
  surface,
  editing,
  hasConfig,
  onConfigure,
  onRemove,
  children,
}: {
  title: string
  icon: IconName
  surface: 'glass' | 'solid' | 'outline' | 'none'
  editing: boolean
  hasConfig: boolean
  onConfigure: () => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="wframe" data-editing={editing}>
      <div className="wframe__surface surface" data-scope={surface} />

      {editing ? (
        <div className="wframe__bar">
          <span className="wframe__drag" title={`Move ${title}`}>
            <Icon name="drag" />
          </span>
          <span className="wframe__title">
            <Icon name={icon} /> {title}
          </span>
          <span className="wframe__tools">
            {hasConfig ? (
              <button
                type="button"
                className="wframe__tool"
                onClick={onConfigure}
                title={`${title} options`}
                aria-label={`${title} options`}
              >
                <Icon name="sliders" />
              </button>
            ) : null}
            <button
              type="button"
              className="wframe__tool"
              onClick={onRemove}
              title={`Remove ${title}`}
              aria-label={`Remove ${title}`}
            >
              <Icon name="close" />
            </button>
          </span>
        </div>
      ) : null}

      <div className="wframe__body">{children}</div>
    </div>
  )
}
