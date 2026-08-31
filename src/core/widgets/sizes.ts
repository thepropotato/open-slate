/**
 * Standard widget footprints. The canvas is a grid of square cells (one cell is
 * "small") and a widget may only take one of the sizes below, so they always tile.
 */

/** Grid footprint, measured in canvas cells. */
export interface WidgetSize {
  w: number
  h: number
}

export const WIDGET_SIZES = {
  small: { w: 1, h: 1 },
  medium: { w: 2, h: 1 },
  large: { w: 2, h: 2 },
  wide: { w: 4, h: 1 },
  xlarge: { w: 4, h: 2 },
} as const satisfies Record<string, WidgetSize>

export type WidgetSizeName = keyof typeof WIDGET_SIZES

// Smallest footprint first.
export const SIZE_ORDER = ['small', 'medium', 'large', 'wide', 'xlarge'] as const

export const SIZE_LABELS: Record<WidgetSizeName, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  wide: 'Wide',
  xlarge: 'Extra large',
}

/** Used when a widget definition does not declare sizes. */
export const DEFAULT_SIZES: readonly WidgetSizeName[] = ['medium', 'large', 'xlarge']

export const sizeOf = (name: WidgetSizeName): WidgetSize => WIDGET_SIZES[name]

const area = (size: WidgetSize) => size.w * size.h

/** Declared sizes in display order, with duplicates and typos dropped. */
export function orderSizes(names: readonly WidgetSizeName[]): WidgetSizeName[] {
  const wanted = new Set(names)
  const out = SIZE_ORDER.filter((name) => wanted.has(name))
  return out.length > 0 ? out : [...DEFAULT_SIZES]
}

/** Never empty: if nothing fits `cols`, the narrowest declared size wins and overflows. */
export function sizesFitting(names: readonly WidgetSizeName[], cols: number): WidgetSizeName[] {
  const ordered = orderSizes(names)
  const fitting = ordered.filter((name) => WIDGET_SIZES[name].w <= cols)
  return fitting.length > 0 ? fitting : [ordered[0]]
}

/** Nearest declared size, in cells. Ties go to the smaller, so a short drag never jumps two sizes. */
export function snapSize(
  proposed: WidgetSize,
  names: readonly WidgetSizeName[],
  cols = Infinity,
): WidgetSizeName {
  const options = sizesFitting(names, cols)
  let best = options[0]
  let bestScore = Infinity
  for (const name of options) {
    const size = WIDGET_SIZES[name]
    const score = (size.w - proposed.w) ** 2 + (size.h - proposed.h) ** 2
    if (score < bestScore || (score === bestScore && area(size) < area(WIDGET_SIZES[best]))) {
      best = name
      bestScore = score
    }
  }
  return best
}

/** The name of an exact footprint, or the nearest declared one. */
export const nameOfSize = (size: WidgetSize, names: readonly WidgetSizeName[]): WidgetSizeName => {
  const exact = SIZE_ORDER.find((name) => {
    const candidate = WIDGET_SIZES[name]
    return candidate.w === size.w && candidate.h === size.h
  })
  return exact ?? snapSize(size, names)
}
