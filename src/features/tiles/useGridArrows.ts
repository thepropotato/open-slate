import { useEffect, type RefObject } from 'react'

/**
 * Arrow-key navigation across a wrapped grid of links.
 *
 * The column count is measured from the rendered rows rather than read from
 * settings, because with `columns: auto` only the layout knows how many fit —
 * and a per-row measurement also handles a ragged last row correctly.
 */
export function useGridArrows(ref: RefObject<HTMLElement | null>, selector: string): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return

    const onKeyDown = (event: KeyboardEvent) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
      if (!keys.includes(event.key) || event.metaKey || event.ctrlKey || event.altKey) return

      const items = [...container.querySelectorAll<HTMLElement>(selector)]
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (index < 0) return

      const firstTop = items[0].offsetTop
      const columns = Math.max(1, items.filter((item) => item.offsetTop === firstTop).length)

      const next =
        event.key === 'ArrowLeft'
          ? index - 1
          : event.key === 'ArrowRight'
            ? index + 1
            : event.key === 'ArrowUp'
              ? index - columns
              : event.key === 'ArrowDown'
                ? index + columns
                : event.key === 'Home'
                  ? 0
                  : items.length - 1

      const target = items[Math.max(0, Math.min(items.length - 1, next))]
      if (!target || target === items[index]) return
      event.preventDefault()
      target.focus()
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [ref, selector])
}
