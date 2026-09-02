/**
 * Non-overlap is an invariant of the stored layout, so every write goes through
 * `normalizeLayout` - `ResponsiveGridLayout` only compacts what is on screen.
 */

import type { Compactor } from 'react-grid-layout/core'
import type { GridItem } from '@/core/settings/schema'
import { DEFAULT_SIZES, sizeOf, snapSize, type WidgetSizeName } from './sizes'

// Looser than `GridItem` so these functions can also pack the library's own layout items.
interface Box {
  i: string
  x: number
  y: number
  w: number
  h: number
  // The library's pinned-item flag. Never set by this app, honoured anyway.
  static?: boolean
}

export const collides = (a: Box, b: Box): boolean =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Used by the tests and nowhere else. */
export function hasOverlap(items: readonly Box[]): boolean {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (collides(items[i], items[j])) return true
    }
  }
  return false
}

// Reading order: top row first, then left to right within the row.
const byRowCol = (a: Box, b: Box) => a.y - b.y || a.x - b.x || (a.i < b.i ? -1 : 1)
const byColRow = (a: Box, b: Box) => a.x - b.x || a.y - b.y || (a.i < b.i ? -1 : 1)

/**
 * Packs a layout one item at a time. `slide` walks an item towards the gravity
 * edge before commit. Pinned items are committed first so nothing packs into them.
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

  // Caller's order, so React keys and stored layouts stay stable.
  return items.map((item) => out.get(item.i) ?? item)
}

/** Resolves overlaps without gravity: an item keeps its position, or falls to the first free row below. */
export function nudgeDown<T extends Box>(items: readonly T[], cols: number): T[] {
  const bounded = items.map((item) => ({
    ...item,
    x: Math.max(0, Math.min(item.x, Math.max(0, cols - item.w))),
  }))
  return pack(bounded, byRowCol, null, (item, blocker) => {
    item.y = blocker.y + blocker.h
  })
}

/** Mirrors the library's own vertical compactor. */
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
 * The layout as a single column, for windows too narrow to render it. Derived on
 * the way to the screen and never stored, so narrowing a window is non-destructive.
 */
export function stackVertically<T extends Box>(items: readonly T[], cols: number): T[] {
  let y = 0
  const stacked = new Map<string, T>()
  for (const item of [...items].sort(byRowCol)) {
    stacked.set(item.i, { ...item, x: 0, y, w: cols })
    y += item.h
  }
  // Caller's order, so React keys stay stable across the switch.
  return items.map((item) => stacked.get(item.i) ?? item)
}

/**
 * Every footprint becomes a standard size, inside the grid, overlapping nothing.
 * `sizesFor` returns the sizes an instance may take; unknown ids get the defaults.
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
 * The library's `noCompactor` is the identity function, so a growing widget never
 * pushes off its neighbours. `nudgeDown` keeps free mode correct during the gesture.
 */
export const freeCompactor: Compactor = {
  type: null,
  allowOverlap: false,
  compact: (layout, cols) => nudgeDown(layout, cols),
}
