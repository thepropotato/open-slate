import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button } from '@/core/ui'
import { permissions, type OptionalPermission } from '@/core/platform/browser'
import './list.css'

/**
 * Shared scaffolding for widgets that read browser data.
 *
 * All of them need the same three states — permission not granted, loading, and
 * empty — and the same row shape. Keeping that here means each widget file is
 * just its query and its row contents.
 */

/** Wraps content that needs optional permissions, offering to request them. */
export function PermissionGate({
  needs,
  reason,
  children,
}: {
  needs: OptionalPermission[]
  reason: string
  children: ReactNode
}) {
  const granted = useAsyncValue(`perm:${needs.join(',')}`, () => permissions.has(needs))

  if (granted === null) return <ListLoading />

  if (!granted) {
    return (
      <div className="blist blist--empty">
        <p>{reason}</p>
        <Button
          icon="check"
          onClick={() =>
            void permissions.request(needs).then((ok) => {
              // The widget's queries all sit behind this gate, so a reload is
              // the simplest way to let every one of them re-run.
              if (ok) window.location.reload()
            })
          }
        >
          Allow
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

export function ListLoading() {
  return (
    <div className="blist blist--empty">
      <Icon name="spinner" spin />
    </div>
  )
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="blist blist--empty">
      <p>{children}</p>
    </div>
  )
}

export function ListHeader({
  title,
  badge,
  tools,
}: {
  title: string
  badge?: ReactNode
  tools?: ReactNode
}) {
  return (
    <div className="blist__head">
      <span className="blist__headtitle">{title}</span>
      {badge !== undefined ? <span className="blist__badge">{badge}</span> : null}
      {tools ? <span className="blist__headtools">{tools}</span> : null}
    </div>
  )
}

export function ListRow({
  title,
  subtitle,
  image,
  icon,
  action,
  onClick,
  onAction,
  actionLabel,
}: {
  title: string
  subtitle?: string
  image?: string
  icon?: IconName
  action?: IconName
  onClick: () => void
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div className="blist__rowwrap">
      <button type="button" className="blist__item" onClick={onClick} title={subtitle || title}>
        <span className="blist__icon">
          {image ? (
            <img src={image} alt="" width={16} height={16} loading="lazy" />
          ) : icon ? (
            <Icon name={icon} />
          ) : null}
        </span>
        <span className="blist__text">
          <span className="blist__title">{title}</span>
          {subtitle ? <span className="blist__sub">{subtitle}</span> : null}
        </span>
        {action && !onAction ? <Icon name={action} className="blist__action" /> : null}
      </button>
      {action && onAction ? (
        <button
          type="button"
          className="blist__rowaction"
          onClick={onAction}
          title={actionLabel}
          aria-label={actionLabel}
        >
          <Icon name={action} />
        </button>
      ) : null}
    </div>
  )
}

/** A small inline filter box, used by the history and tabs widgets. */
export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
}) {
  return (
    <label className="blist__search">
      <Icon name="search" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        aria-label={placeholder}
      />
    </label>
  )
}
