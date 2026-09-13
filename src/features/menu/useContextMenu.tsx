import { useCallback, useState } from 'react'
import { ContextMenu, type MenuAnchor, type MenuItem } from './ContextMenu'

/**
 * Right-click handling for a band. `build` is asked for the items at the moment
 * of the click, so it can read the event's target and offer what was clicked on.
 */
export function useContextMenu(build: (event: React.MouseEvent) => MenuItem[]) {
  const [at, setAt] = useState<MenuAnchor | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const next = build(event)
      if (next.length === 0) return
      event.preventDefault()
      setItems(next)
      setAt({ x: event.clientX, y: event.clientY })
    },
    [build],
  )

  const close = useCallback(() => setAt(null), [])

  return {
    onContextMenu,
    open: at !== null,
    menu: at ? <ContextMenu at={at} items={items} onClose={close} /> : null,
  }
}
