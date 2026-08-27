import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/core/icons'

/**
 * Chrome around a widget: the surface, and the controls that only appear while
 * the canvas is unlocked.
 *
 * The bar lives *inside* the widget. It used to float in the gutter above,
 * which put it on top of whatever was in the row above it and clipped it off
 * the page entirely for the top row — so the control you reached for often
 * belonged to a different widget than the one under the pointer.
 *
 * Dragging is the whole widget rather than the grip alone (see the canvas's
 * `dragConfig`); the grip stays as the affordance that says so.
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
          <span className="wframe__drag" aria-hidden="true">
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
