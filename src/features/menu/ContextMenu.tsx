import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/core/icons/Icon'
import type { IconName } from '@/core/icons/registry'
import './ContextMenu.css'

export type MenuItem = {
  id: string
  label: string
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  separatorBefore?: boolean
}

export type MenuAnchor = { x: number; y: number }

/** Portalled, so no band's `overflow` can clip it. */
export function ContextMenu({
  at,
  items,
  onClose,
}: {
  at: MenuAnchor
  items: MenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const [active, setActive] = useState(0)

  // Measured, not guessed: the width depends on the longest label.
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const pad = 8
    const flipX = at.x + box.width + pad > window.innerWidth
    const flipY = at.y + box.height + pad > window.innerHeight
    setPlace({
      left: Math.max(pad, flipX ? at.x - box.width : at.x),
      top: Math.max(pad, flipY ? at.y - box.height : at.y),
    })
  }, [at.x, at.y, items.length])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  // Anything that moves the page from under the menu dismisses it.
  useEffect(() => {
    const away = () => onClose()
    window.addEventListener('resize', away)
    window.addEventListener('blur', away)
    window.addEventListener('scroll', away, true)
    return () => {
      window.removeEventListener('resize', away)
      window.removeEventListener('blur', away)
      window.removeEventListener('scroll', away, true)
    }
  }, [onClose])

  const step = (by: number) =>
    setActive((current) => (current + by + items.length) % items.length)

  return createPortal(
    <>
      {/* Swallows the dismissing click, so it cannot also land on a tile. */}
      <div
        className="cmenu__catch"
        onPointerDown={(event) => {
          event.preventDefault()
          onClose()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={ref}
        className="cmenu"
        role="menu"
        tabIndex={-1}
        aria-label="Actions"
        // Hidden until placed, so it is never seen at the unflipped position.
        style={{ left: place?.left ?? at.x, top: place?.top ?? at.y, opacity: place ? 1 : 0 }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            step(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            step(-1)
          } else if (event.key === 'Home') {
            event.preventDefault()
            setActive(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            setActive(items.length - 1)
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            items[active]?.onSelect()
            onClose()
          }
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="cmenu__item"
            data-danger={item.danger || undefined}
            data-sep={item.separatorBefore || undefined}
            data-active={index === active || undefined}
            onPointerEnter={() => setActive(index)}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            {item.icon ? <Icon name={item.icon} /> : <span className="cmenu__gap" />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>,
    document.body,
  )
}
