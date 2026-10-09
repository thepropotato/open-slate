import { useState, useRef, useEffect } from 'react'
import { Icon } from '@/core/icons'
import type { Pane } from '@/core/settings/schema'
import { triggerAddTile, triggerAddWidget } from '@/core/events'
import { useClosing } from '@/core/hooks'
import './TopAddButton.css'

export function TopAddButton({
  active,
  panes,
  viewMode,
  direction = 'down',
  onSelectPane,
}: {
  active: Pane
  panes: readonly Pane[]
  viewMode: 'tabs' | 'scroll'
  direction?: 'down' | 'up'
  onSelectPane?: (pane: Pane) => void
}) {
  const [open, setOpen] = useState(false)
  const { closing, handleClose } = useClosing(() => setOpen(false), 140)
  const menuRef = useRef<HTMLDivElement>(null)

  const hasWidgets = panes.includes('widgets')
  const hasTiles = panes.includes('tiles')

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        handleClose()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, handleClose])

  if (!hasWidgets && !hasTiles) return null

  const handleAddWidget = () => {
    handleClose()
    if (viewMode === 'tabs' && active !== 'widgets') {
      onSelectPane?.('widgets')
    }
    setTimeout(() => triggerAddWidget(), 20)
  }

  const handleAddTile = () => {
    handleClose()
    if (viewMode === 'tabs' && active !== 'tiles') {
      onSelectPane?.('tiles')
    }
    setTimeout(() => triggerAddTile(), 20)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMode === 'tabs') {
      // In tab-wise mode: 1-click adds directly to the active tab
      if (active === 'widgets' && hasWidgets) {
        handleAddWidget()
      } else if (active === 'tiles' && hasTiles) {
        handleAddTile()
      } else if (hasWidgets) {
        handleAddWidget()
      } else {
        handleAddTile()
      }
    } else {
      // In continuous (scroll) mode:
      if (hasWidgets && hasTiles) {
        if (open) {
          handleClose()
        } else {
          setOpen(true)
        }
      } else if (hasWidgets) {
        handleAddWidget()
      } else {
        handleAddTile()
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    // In tab-wise mode when both are enabled, right-clicking reveals options for both
    if (hasWidgets && hasTiles) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(true)
    }
  }

  const title =
    viewMode === 'tabs'
      ? active === 'widgets'
        ? 'Add a widget'
        : 'Add a tile'
      : hasWidgets && hasTiles
        ? 'Add a widget or tile'
        : hasWidgets
          ? 'Add a widget'
          : 'Add a tile'

  return (
    <div className="top-add" data-direction={direction} ref={menuRef}>
      <button
        type="button"
        className="top-add__btn is-icon-btn"
        title={title}
        aria-label={title}
        aria-haspopup={viewMode === 'scroll' && hasWidgets && hasTiles ? 'menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <Icon name="add" />
      </button>

      {open && (
        <div className="top-add__menu" role="menu" data-closing={closing || undefined}>
          {hasWidgets && (
            <button
              type="button"
              className="top-add__menu-item"
              role="menuitem"
              onClick={handleAddWidget}
            >
              <Icon name="layers" />
              <span>Add a widget</span>
            </button>
          )}
          {hasTiles && (
            <button
              type="button"
              className="top-add__menu-item"
              role="menuitem"
              onClick={handleAddTile}
            >
              <Icon name="link" />
              <span>Add a tile</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

