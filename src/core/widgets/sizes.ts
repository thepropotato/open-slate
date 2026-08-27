/**
 * Standard widget footprints.
 *
 * The canvas is a grid of square cells — one cell is a "small" widget — and a
 * widget may only occupy one of the footprints below, the way iOS and macOS
 * widgets do. Free-form resizing let every widget land on its own arbitrary
 * height, which is what made a dashboard look ragged; a short list of sizes
 * that always tile against each other cannot.
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

/** Display order, smallest footprint first. */
export const SIZE_ORDER = ['small', 'medium', 'large', 'wide', 'xlarge'] as const

export const SIZE_LABELS: Record<WidgetSizeName, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  wide: 'Wide',
  xlarge: 'Extra large',
}

/** What a widget gets when its definition does not say otherwise. */
export const DEFAULT_SIZES: readonly WidgetSizeName[] = ['medium', 'large', 'xlarge']

export const sizeOf = (name: WidgetSizeName): WidgetSize => WIDGET_SIZES[name]

const area = (size: WidgetSize) => size.w * size.h

/** The declared sizes, in display order, with duplicates and typos dropped. */
export function orderSizes(names: readonly WidgetSizeName[]): WidgetSizeName[] {
  const wanted = new Set(names)
  const out = SIZE_ORDER.filter((name) => wanted.has(name))
  return out.length > 0 ? out : [...DEFAULT_SIZES]
}

/**
 * The subset that fits inside `cols` columns. Never empty: a canvas narrower
 * than every declared size still has to render something, so the narrowest
 * declared size wins even if it overflows.
 */
export function sizesFitting(names: readonly WidgetSizeName[], cols: number): WidgetSizeName[] {
  const ordered = orderSizes(names)
  const fitting = ordered.filter((name) => WIDGET_SIZES[name].w <= cols)
  return fitting.length > 0 ? fitting : [ordered[0]]
}

/**
 * The declared size closest to a free-form footprint.
 *
 * Distance is measured in cells, and a tie goes to the smaller footprint, so
 * dragging a resize handle a little way never jumps a widget up two sizes.
 */
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
