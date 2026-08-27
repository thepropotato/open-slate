import { SETTINGS_VERSION, Settings, type GridItem, type Settings as SettingsType } from './schema'
import { colsFor, normalizeLayout, type CompactMode } from '@/core/widgets/layout'
import { SIZE_ORDER, WIDGET_SIZES, snapSize } from '@/core/widgets/sizes'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Ordered upgrade steps, indexed by the version they upgrade *from*.
 * Adding a field never needs a migration — zod defaults cover that. Only
 * renames, moves and semantic changes belong here.
 */
const migrations: Record<number, Migration> = {
  // 0: (raw) => ({ ...raw, appearance: { ...raw.appearance, ... } }),
  1: toStandardWidgetSizes,
  2: separateOverlappingWidgets,
}

/* --------------------------------------------------------------- 1 -> 2 */

/**
 * The widget canvas used to be a fine 24-column grid of short rows that widgets
 * could be resized to any footprint on. It is now a coarse grid of square cells
 * with a handful of standard sizes, so every stored layout has to be rescaled
 * and then snapped onto the nearest of those sizes.
 *
 * Positions are converted proportionally, which keeps an existing arrangement
 * recognisable — a widget that sat top-right stays top-right.
 */
const OLD_COLS = 24
const NEW_COLS = 6
/** Pitch of one new square cell in px, at the default canvas width. */
const NEW_CELL_PITCH = 199

function toStandardWidgetSizes(raw: Record<string, unknown>): Record<string, unknown> {
  const widgets = (raw.widgets ?? {}) as Record<string, unknown>
  const layouts = (widgets.layouts ?? {}) as Record<string, unknown>

  const oldCols = typeof widgets.columns === 'number' ? widgets.columns : OLD_COLS
  const oldRowPitch =
    (typeof widgets.rowHeight === 'number' ? widgets.rowHeight : 56) +
    (typeof widgets.margin === 'number' ? widgets.margin : 14)
  const xScale = NEW_COLS / Math.max(1, oldCols)
  const yScale = oldRowPitch / NEW_CELL_PITCH

  const next: Record<string, unknown[]> = {}
  for (const [breakpoint, items] of Object.entries(layouts)) {
    if (!Array.isArray(items)) continue
    next[breakpoint] = items.map((item) => {
      const { i, x, y, w, h } = item as Record<string, unknown>
      const scaled = {
        w: Math.max(1, Math.round(num(w, 4) * xScale)),
        h: Math.max(1, Math.round(num(h, 3) * yScale)),
      }
      const snapped = WIDGET_SIZES[snapSize(scaled, SIZE_ORDER)]
      return {
        i,
        x: Math.max(0, Math.round(num(x, 0) * xScale)),
        y: Math.max(0, Math.round(num(y, 0) * yScale)),
        ...snapped,
      }
    })
  }

  // `columns` changes meaning (fine positioning steps -> widgets across) and
  // `rowHeight` no longer exists: cells are square, derived from the width.
  const rest = { ...widgets }
  delete rest.rowHeight
  return { ...raw, widgets: { ...rest, columns: NEW_COLS, layouts: next } }
}

/* --------------------------------------------------------------- 2 -> 3 */

/**
 * Until now only the breakpoint on screen was ever checked for collisions, so
 * the narrower layouts drifted into stacks of widgets sitting on top of each
 * other — invisible until the window was resized. The canvas now guarantees
 * this on every write; existing blobs are separated once, here, so a dashboard
 * is not broken up to the moment it is first touched.
 *
 * Sizes are left alone: every standard footprint is accepted, so this only ever
 * moves a widget that was genuinely underneath another one.
 */
function separateOverlappingWidgets(raw: Record<string, unknown>): Record<string, unknown> {
  const widgets = (raw.widgets ?? {}) as Record<string, unknown>
  const layouts = widgets.layouts
  if (layouts === null || typeof layouts !== 'object') return raw

  const compact = (
    ['vertical', 'horizontal', 'none'].includes(widgets.compact as string)
      ? widgets.compact
      : 'vertical'
  ) as CompactMode
  const cols = colsFor(num(widgets.columns, NEW_COLS))

  const next: Record<string, GridItem[]> = {}
  for (const [breakpoint, items] of Object.entries(layouts)) {
    if (!Array.isArray(items)) continue
    const clean = items.filter(isGridItem)
    const columns = cols[breakpoint as keyof typeof cols] ?? cols.lg
    next[breakpoint] = normalizeLayout(clean, columns, () => SIZE_ORDER, compact)
  }
  return { ...raw, widgets: { ...widgets, layouts: next } }
}

const isGridItem = (value: unknown): value is GridItem => {
  if (value === null || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.i === 'string' &&
    ['x', 'y', 'w', 'h'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key]))
  )
}

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Brings any previously-stored blob up to the current shape. Never throws. */
export function migrate(raw: unknown): SettingsType {
  if (raw === null || typeof raw !== 'object') return Settings.parse({})

  let data = raw as Record<string, unknown>
  let version = typeof data.version === 'number' ? data.version : 0

  while (version < SETTINGS_VERSION) {
    const step = migrations[version]
    if (step) data = step(data)
    version += 1
  }
  data = { ...data, version: SETTINGS_VERSION }

  const parsed = Settings.safeParse(data)
  if (parsed.success) return parsed.data

  // A corrupted or partially-invalid blob should degrade to defaults for the
  // broken sections rather than wiping everything the user configured.
  console.warn('[settings] falling back to defaults for invalid fields', parsed.error.issues)
  return Settings.parse(salvage(data))
}

/** Drops only the top-level sections that fail validation. */
function salvage(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { version: SETTINGS_VERSION }
  const shape = Settings.shape as Record<string, { safeParse(v: unknown): { success: boolean } }>
  for (const key of Object.keys(shape)) {
    if (key === 'version' || !(key in data)) continue
    if (shape[key].safeParse(data[key]).success) out[key] = data[key]
  }
  return out
}
