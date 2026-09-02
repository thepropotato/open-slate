import { SETTINGS_VERSION, Settings, type GridItem, type Settings as SettingsType } from './schema'
import { normalizeLayout, type CompactMode } from '@/core/widgets/layout'
import { SIZE_ORDER, WIDGET_SIZES, snapSize } from '@/core/widgets/sizes'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Upgrade steps, indexed by the version they upgrade *from*. Adding a field needs
 * no migration (zod defaults cover it); only renames, moves and semantic changes.
 */
const migrations: Record<number, Migration> = {
  // 0: (raw) => ({ ...raw, appearance: { ...raw.appearance, ... } }),
  1: toStandardWidgetSizes,
  2: separateOverlappingWidgets,
  3: toSingleLayout,
}

// 1 -> 2: a fine 24-column grid becomes square cells with standard sizes. Positions
// scale proportionally so an arrangement stays recognisable; footprints snap.
const OLD_COLS = 24
const NEW_COLS = 6
// Pitch of one new square cell in px, at the default canvas width.
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

  // `columns` changes meaning (positioning steps -> widgets across); `rowHeight`
  // is gone, as cells are square and derived from the width.
  const rest = { ...widgets }
  delete rest.rowHeight
  return { ...raw, widgets: { ...rest, columns: NEW_COLS, layouts: next } }
}

/**
 * 2 -> 3: off-screen breakpoints were never collision-checked, so stored layouts
 * can contain stacked widgets. Separates them once. Sizes are left alone.
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
  const columns = num(widgets.columns, NEW_COLS)

  const next: Record<string, GridItem[]> = {}
  for (const [breakpoint, items] of Object.entries(layouts)) {
    if (!Array.isArray(items)) continue
    next[breakpoint] = normalizeLayout(items.filter(isGridItem), columns, () => SIZE_ORDER, compact)
  }
  return { ...raw, widgets: { ...widgets, layouts: next } }
}

/**
 * 3 -> 4: three per-breakpoint layouts collapse to one. `lg` wins - the narrower
 * ones were only ever clamped copies of it, regenerated and written back on resize.
 */
function toSingleLayout(raw: Record<string, unknown>): Record<string, unknown> {
  const widgets = (raw.widgets ?? {}) as Record<string, unknown>
  const layouts = widgets.layouts
  const rest = { ...widgets }
  delete rest.layouts

  if (layouts === null || typeof layouts !== 'object') return { ...raw, widgets: rest }

  const byBreakpoint = layouts as Record<string, unknown>
  // Widest first: `lg` if it has anything, else whatever else was stored.
  const candidates = ['lg', 'md', 'sm', ...Object.keys(byBreakpoint)]
  for (const key of candidates) {
    const items = byBreakpoint[key]
    if (!Array.isArray(items)) continue
    const clean = items.filter(isGridItem)
    if (clean.length > 0) return { ...raw, widgets: { ...rest, layout: clean } }
  }
  return { ...raw, widgets: rest }
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

  // Degrade only the broken sections, rather than wiping everything configured.
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
