import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/core/icons'

// Chrome around a widget: surface plus the controls shown while unlocked.
// The bar sits inside the widget so it can't overlap the row above or clip off
// the top of the page. The grip is only an affordance; the whole widget drags.
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
                className="wframe__tool is-icon-btn"
                onClick={onConfigure}
                title={`${title} options`}
                aria-label={`${title} options`}
              >
                <Icon name="sliders" />
              </button>
            ) : null}
            <button
              type="button"
              className="wframe__tool is-icon-btn"
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
