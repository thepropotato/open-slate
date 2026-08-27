/**
 * Keeping the canvas free of stacked widgets.
 *
 * `ResponsiveGridLayout` only ever compacts the layout for the breakpoint that
 * is currently on screen. Everything that rewrites the *other* breakpoints —
 * clamping a footprint into a narrower column count, applying a size from the
 * config dialog, placing a newly added widget — used to do so with no collision
 * handling at all, and then the whole set was persisted. Narrow the window and
 * you were looking at a layout nothing had ever validated.
 *
 * So non-overlap is treated as an invariant of the stored data rather than as a
 * side effect of which breakpoint happens to be visible: every write goes
 * through `normalizeLayout`, for every breakpoint.
 */

import type { Compactor } from 'react-grid-layout/core'
import type { GridItem } from '@/core/settings/schema'
import { DEFAULT_SIZES, sizeOf, snapSize, type WidgetSizeName } from './sizes'

/**
 * The shape the packing below actually needs. Deliberately looser than
 * `GridItem` so the same functions can pack the library's own layout items,
 * which carry drag flags this module has no business knowing about.
 */
interface Box {
  i: string
  x: number
  y: number
  w: number
  h: number
  /** The library's pinned-item flag. Never set by this app, honoured anyway. */
  static?: boolean
}

/** Do two footprints share any cell? */
export const collides = (a: Box, b: Box): boolean =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Whether any pair in the layout overlaps. Used by the tests and nowhere else. */
export function hasOverlap(items: readonly Box[]): boolean {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (collides(items[i], items[j])) return true
    }
  }
  return false
}

/** Reading order: top row first, then left to right within the row. */
const byRowCol = (a: Box, b: Box) => a.y - b.y || a.x - b.x || (a.i < b.i ? -1 : 1)
const byColRow = (a: Box, b: Box) => a.x - b.x || a.y - b.y || (a.i < b.i ? -1 : 1)

/**
 * Packs a layout, one item at a time, in the given order.
 *
 * `slide` walks an item towards the gravity edge before it is committed; every
 * strategy then shares the same collision loop, which drops the item past
 * whatever it landed on until the cell is clear. Pinned items are committed
 * first so nothing is ever packed into the space one of them occupies.
 */
function pack<T extends Box>(
  items: readonly T[],
  order: (a: Box, b: Box) => number,
  slide: ((item: Box, placed: readonly Box[]) => void) | null,
  resolve: (item: Box, blocker: Box) => void,
): T[] {
  const placed: Box[] = items.filter((item) => item.static)
  const out = new Map<string, T>()

  for (const item of [...items].sort(order)) {
    if (item.static) {
      out.set(item.i, item)
      continue
    }
    const next = { ...item, x: Math.max(0, item.x), y: Math.max(0, item.y) }
    slide?.(next, placed)
    let blocker = placed.find((other) => collides(next, other))
    while (blocker) {
      resolve(next, blocker)
      blocker = placed.find((other) => collides(next, other))
    }
    placed.push(next)
    out.set(next.i, next)
  }

  // Emit in the caller's order so React keys and stored layouts stay stable.
  return items.map((item) => out.get(item.i) ?? item)
}

/**
 * Resolves overlaps without applying gravity.
 *
 * Items are placed in reading order and keep the position they were given; one
 * that lands on top of something already placed falls to the first row below
 * where it fits. That is what "free placement" has to mean here — a widget
 * stays where you put it, but it never sits on top of another one.
 */
export function nudgeDown<T extends Box>(items: readonly T[], cols: number): T[] {
  const bounded = items.map((item) => ({
    ...item,
    x: Math.max(0, Math.min(item.x, Math.max(0, cols - item.w))),
  }))
  return pack(bounded, byRowCol, null, (item, blocker) => {
    item.y = blocker.y + blocker.h
  })
}

/** Gravity towards the top edge. Mirrors the library's own vertical compactor. */
function compactVertical<T extends Box>(items: readonly T[]): T[] {
  return pack(
    items,
    byRowCol,
    (item, placed) => {
      while (item.y > 0 && !placed.some((other) => collides({ ...item, y: item.y - 1 }, other))) {
        item.y -= 1
      }
    },
    (item, blocker) => {
      item.y = blocker.y + blocker.h
    },
  )
}

/** Gravity towards the left edge, wrapping to the next row at the boundary. */
function compactHorizontal<T extends Box>(items: readonly T[], cols: number): T[] {
  return pack(
    items,
    byColRow,
    (item, placed) => {
      while (item.x > 0 && !placed.some((other) => collides({ ...item, x: item.x - 1 }, other))) {
        item.x -= 1
      }
    },
    (item, blocker) => {
      item.x = blocker.x + blocker.w
      if (item.x + item.w > cols) {
        item.x = 0
        item.y += 1
      }
    },
  )
}

export type CompactMode = 'vertical' | 'horizontal' | 'none'

/**
 * Cells across at each breakpoint, scaled down from the configured width.
 *
 * Shared with the migration so a stored layout is separated against exactly the
 * column counts the canvas will later render it at.
 */
export const colsFor = (columns: number) => ({
  lg: columns,
  md: Math.max(2, Math.ceil(columns * (2 / 3))),
  sm: 2,
})

/**
 * Brings one breakpoint's layout into a state the canvas can render: every
 * footprint is one of the widget's standard sizes, sits inside the grid, and
 * overlaps nothing.
 *
 * `sizesFor` returns the standard sizes an instance is allowed to take; an
 * unknown instance falls back to the default set.
 */
export function normalizeLayout(
  items: readonly GridItem[],
  cols: number,
  sizesFor: (id: string) => readonly WidgetSizeName[] | undefined,
  compact: CompactMode,
): GridItem[] {
  const fitted = items.map((item) => {
    const size = sizeOf(snapSize(item, sizesFor(item.i) ?? DEFAULT_SIZES, cols))
    return {
      i: item.i,
      x: Math.max(0, Math.min(Math.round(item.x), Math.max(0, cols - size.w))),
      y: Math.max(0, Math.round(item.y)),
      ...size,
    }
  })

  if (compact === 'vertical') return compactVertical(fitted)
  if (compact === 'horizontal') return compactHorizontal(fitted, cols)
  return nudgeDown(fitted, cols)
}

/**
 * "Free" compaction, as the library sees it.
 *
 * The library's own `noCompactor` is the identity function, which means a
 * *growing* widget is never pushed off its neighbours — collisions on resize
 * are only ever resolved through compaction. Plugging `nudgeDown` in here fixes
 * that at the source, so free mode is correct during the gesture rather than
 * only once the layout has been written back.
 */
export const freeCompactor: Compactor = {
  type: null,
  allowOverlap: false,
  compact: (layout, cols) => nudgeDown(layout, cols),
}
