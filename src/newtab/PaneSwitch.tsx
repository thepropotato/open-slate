import { Icon, type IconName } from '@/core/icons'
import type { Pane } from '@/core/settings/schema'

const PANES: { id: Pane; label: string; icon: IconName }[] = [
  { id: 'widgets', label: 'Widgets', icon: 'layers' },
  { id: 'tiles', label: 'Tiles', icon: 'layout' },
]

/**
 * The widgets/tiles switch. Tabs mode only - a scrolling page already shows both.
 * Arrow keys move between the two once focused; the page owns the modifier shortcuts.
 */
export function PaneSwitch({
  active,
  panes,
  onSelect,
}: {
  active: Pane
  panes: readonly Pane[]
  /** Omitted in the settings preview, whose subtree is `inert`. */
  onSelect?: (pane: Pane) => void
}) {
  const shown = PANES.filter((pane) => panes.includes(pane.id))
  if (shown.length < 2) return null

  const step = (delta: number) => {
    const index = shown.findIndex((pane) => pane.id === active)
    onSelect?.(shown[(index + delta + shown.length) % shown.length].id)
  }

  return (
    <nav
      className="paneswitch"
      aria-label="Page sections"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        step(event.key === 'ArrowRight' ? 1 : -1)
      }}
    >
      {shown.map((pane) => (
        <button
          key={pane.id}
          type="button"
          className="paneswitch__item"
          aria-current={pane.id === active}
          onClick={() => onSelect?.(pane.id)}
        >
          <Icon name={pane.icon} />
          <span>{pane.label}</span>
        </button>
      ))}
    </nav>
  )
}
