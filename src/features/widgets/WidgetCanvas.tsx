import { Suspense, useCallback, useId, useMemo, useState, type Ref } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import {
  ResponsiveGridLayout,
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  horizontalCompactor,
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import { gridBounds, type LayoutConstraint } from 'react-grid-layout/core'
import { Icon } from '@/core/icons'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { WidgetInstance, type GridItem, type Settings } from '@/core/settings/schema'
import { getWidget, parseWidgetConfig } from '@/core/widgets/registry'
import { colsFor, freeCompactor, normalizeLayout } from '@/core/widgets/layout'
import {
  DEFAULT_SIZES,
  nameOfSize,
  sizeOf,
  sizesFitting,
  snapSize,
  type WidgetSizeName,
} from '@/core/widgets/sizes'
import type { AnyWidgetDefinition } from '@/core/widgets/types'
import { setPath } from '@/core/util/path'
import { uid } from '@/core/util/id'
import { WidgetFrame } from './WidgetFrame'

/*
 * Both dialogs are loaded on demand. The config dialog in particular reaches
 * into the settings-UI field renderer, which would otherwise drag the entire
 * settings layer into the new tab's first paint.
 */
const WidgetPicker = lazyChunk(() => import('./WidgetPicker').then((m) => ({ default: m.WidgetPicker })))
const WidgetConfigDialog = lazyChunk(() =>
  import('./WidgetConfigDialog').then((m) => ({ default: m.WidgetConfigDialog })),
)
import 'react-grid-layout/css/styles.css'
import './widgets.css'

/**
 * Cells stay square and roughly this wide, which is what makes the standard
 * sizes read as the same shapes at every window width: the breakpoints are
 * derived from the column count rather than fixed, so a band never stretches
 * a cell far past this.
 */
const TARGET_CELL = 158

/** Empty rows kept below the last widget while the canvas is unlocked. */
const EDIT_ROOM_ROWS = 1

/** Thresholds that keep every band close to `TARGET_CELL`, strictly decreasing. */
function breakpointsFor(cols: ReturnType<typeof colsFor>) {
  const lg = cols.lg * TARGET_CELL
  return { lg, md: Math.min(cols.md * TARGET_CELL, lg - 1), sm: 0 }
}

const COMPACTORS = {
  vertical: verticalCompactor,
  horizontal: horizontalCompactor,
  // Not the library's `noCompactor`: that one is the identity function, which
  // lets a growing widget settle on top of its neighbours. See `layout.ts`.
  none: freeCompactor,
}

/**
 * The widget dashboard.
 *
 * Layout lives in settings keyed by breakpoint, so a narrow window keeps its own
 * arrangement. Dragging and resizing are off until the canvas is unlocked — a
 * dashboard you can knock out of shape by mis-clicking is worse than a fixed one.
 */
export function WidgetCanvas() {
  const settings = useSettings()
  const { update } = useSettingsActions()
  const { widgets, appearance } = settings

  const [picking, setPicking] = useState(false)
  const [configuring, setConfiguring] = useState<string | null>(null)

  const editing = !widgets.locked

  const cols = useMemo(() => colsFor(widgets.columns), [widgets.columns])
  const breakpoints = useMemo(() => breakpointsFor(cols), [cols])

  const { width, containerRef } = useContainerWidth()

  // The grid picks its own breakpoint from the width; the same choice has to be
  // made here to keep cells square, since row height is a single number.
  const activeCols = getColsFromBreakpoint(getBreakpointFromWidth(breakpoints, width), cols)
  const rowHeight =
    width > 0
      ? Math.max(48, (width - widgets.margin * (activeCols - 1)) / activeCols)
      : TARGET_CELL

  /** Standard sizes each instance is allowed to take, by instance id. */
  const allowed = useMemo(() => {
    const map = new Map<string, readonly WidgetSizeName[]>()
    for (const instance of widgets.instances) {
      map.set(instance.id, getWidget(instance.type)?.sizes ?? DEFAULT_SIZES)
    }
    return map
  }, [widgets.instances])

  /**
   * Normalises every breakpoint at once.
   *
   * The grid only ever validates the breakpoint on screen, so anything that
   * writes a layout has to run all three through here — otherwise the ones off
   * screen drift into overlapping each other and are saved that way.
   */
  const normalizeAll = useCallback(
    (stored: Record<string, GridItem[] | undefined>) => {
      const sizesFor = (id: string) => allowed.get(id)
      const out: Record<string, GridItem[]> = {}
      for (const key of Object.keys(cols)) {
        const columns = cols[key as keyof typeof cols]
        out[key] = normalizeLayout(stored[key] ?? [], columns, sizesFor, widgets.compact)
      }
      return out
    },
    [allowed, cols, widgets.compact],
  )

  const layouts = useMemo<ResponsiveLayouts<string>>(() => {
    const stored = widgets.layouts as Record<string, GridItem[]>
    const known = new Set(widgets.instances.map((i) => i.id))
    const withNew: Record<string, GridItem[]> = {}
    for (const key of Object.keys(cols)) {
      const columns = cols[key as keyof typeof cols]
      const items = (stored[key] ?? []).filter((item) => known.has(item.i))
      const missing = widgets.instances.filter((i) => !items.some((item) => item.i === i.id))
      withNew[key] = [...items, ...place(missing, items, columns)]
    }
    return normalizeAll(withNew)
  }, [widgets.layouts, widgets.instances, cols, normalizeAll])

  /**
   * How tall the canvas is while arranging.
   *
   * An empty row past the last widget, so there is somewhere below to drag one
   * to. Without it the canvas ends flush with the bottom widget and the only
   * way to make a new row is to drop onto an existing one.
   */
  const rows = useMemo(() => {
    const active = getBreakpointFromWidth(breakpoints, width)
    return (layouts[active] ?? []).reduce((max, item) => Math.max(max, item.y + item.h), 0)
  }, [layouts, breakpoints, width])

  const stageHeight = (rows + EDIT_ROOM_ROWS) * (rowHeight + widgets.margin) - widgets.margin

  /**
   * Resizing snaps to the widget's declared standard sizes rather than to
   * single cells, so a drag of the handle steps between whole footprints.
   */
  const constraints = useMemo<LayoutConstraint[]>(
    () => [
      gridBounds,
      {
        name: 'standard-sizes',
        constrainSize(item, w, h, handle, context) {
          const names = allowed.get(item.i) ?? DEFAULT_SIZES
          const room =
            handle === 'w' || handle === 'nw' || handle === 'sw'
              ? item.x + item.w
              : context.cols - item.x
          return sizeOf(snapSize({ w, h }, names, room))
        },
      },
    ],
    [allowed],
  )

  const onLayoutChange = useCallback(
    (_current: Layout, all: ResponsiveLayouts<string>) => {
      const geometry: Record<string, GridItem[]> = {}
      for (const [key, items] of Object.entries(all)) {
        // Store only the geometry, dropping the library's transient item flags.
        geometry[key] = (items ?? []).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
      }
      // The grid hands back its own breakpoint corrected and the others exactly
      // as they were given, so the whole set is re-checked before it is stored.
      const next = normalizeAll(geometry)
      update((current) => {
        // The grid emits a layout on mount as well; skip identical writes.
        if (JSON.stringify(current.widgets.layouts) === JSON.stringify(next)) return current
        return { ...current, widgets: { ...current.widgets, layouts: next } }
      })
    },
    [update, normalizeAll],
  )

  const addWidget = (definition: AnyWidgetDefinition) => {
    const instance = WidgetInstance.parse({ id: uid('w'), type: definition.type })
    update((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        instances: [...current.widgets.instances, instance],
        // Unlock so the newly added widget can be placed straight away.
        locked: false,
      },
    }))
    setPicking(false)
  }

  const removeWidget = (id: string) =>
    update((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        instances: current.widgets.instances.filter((i) => i.id !== id),
        layouts: Object.fromEntries(
          Object.entries(current.widgets.layouts).map(([key, items]) => [
            key,
            items.filter((item) => item.i !== id),
          ]),
        ),
      },
    }))

  /**
   * Applies a standard size to an instance across every breakpoint.
   *
   * Growing a widget is the one change that cannot be made in place: whatever
   * used to sit beside or below it has to move, at every breakpoint, not just
   * the visible one.
   */
  const resizeInstance = (id: string, name: WidgetSizeName) =>
    update((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        layouts: normalizeAll(
          Object.fromEntries(
            Object.entries(current.widgets.layouts).map(([key, items]) => [
              key,
              items.map((item) => (item.i === id ? { ...item, ...sizeOf(name) } : item)),
            ]),
          ),
        ),
      },
    }))

  const patchInstance = (id: string, patch: (instance: WidgetInstance) => WidgetInstance) =>
    update((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        instances: current.widgets.instances.map((i) => (i.id === id ? patch(i) : i)),
      },
    }))

  if (!widgets.enabled) return null

  const configuringInstance = widgets.instances.find((i) => i.id === configuring)
  const configuringDefinition = configuringInstance
    ? getWidget(configuringInstance.type)
    : undefined
  const configuringSize = sizeNameOf(configuringInstance, configuringDefinition, widgets.layouts.lg)

  return (
    <div className="canvas" data-editing={editing}>
      <div className="canvas__stage" style={{ minHeight: editing ? stageHeight : undefined }}>
      <GridSlots cell={rowHeight} gutter={widgets.margin} radius={appearance.radius} />
      <ResponsiveGridLayout
        className="canvas__grid"
        innerRef={containerRef}
        width={width}
        layouts={layouts}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={rowHeight}
        margin={[widgets.margin, widgets.margin]}
        containerPadding={[0, 0]}
        compactor={COMPACTORS[widgets.compact]}
        constraints={constraints}
        /*
         * The whole widget drags, not a 22px grip — a target that small was
         * easy to miss and easy to hit by accident. Widgets keep their own
         * inputs usable because dragging is only on while the canvas is
         * unlocked, and the frame's own buttons are excluded outright.
         */
        dragConfig={{
          enabled: editing,
          handle: '.wframe',
          cancel: '.wframe__tool, .react-resizable-handle',
          bounded: false,
          threshold: 3,
        }}
        resizeConfig={{ enabled: editing, handles: ['se'], handleComponent: resizeGrabber }}
        onLayoutChange={onLayoutChange}
      >
        {widgets.instances.map((instance) => (
          <div key={instance.id}>
            <WidgetHost
              instance={instance}
              settings={settings}
              editing={editing}
              onConfigure={() => setConfiguring(instance.id)}
              onRemove={() => removeWidget(instance.id)}
              onConfigChange={(path, value) =>
                patchInstance(instance.id, (current) => ({
                  ...current,
                  config: setPath(current.config, path, value),
                }))
              }
            />
          </div>
        ))}
      </ResponsiveGridLayout>
      </div>

      <div className="canvas__toolbar">
        <button
          type="button"
          className="canvas__btn"
          onClick={() => setPicking(true)}
          title="Add a widget"
        >
          <Icon name="add" />
          <span>Widget</span>
        </button>
        <button
          type="button"
          className="canvas__btn"
          aria-pressed={editing}
          onClick={() =>
            update((current) => ({
              ...current,
              widgets: { ...current.widgets, locked: !current.widgets.locked },
            }))
          }
          title={editing ? 'Lock the layout' : 'Rearrange widgets'}
        >
          <Icon name={editing ? 'lock' : 'unlock'} />
          <span>{editing ? 'Done' : 'Arrange'}</span>
        </button>
      </div>

      {picking ? (
        <Suspense fallback={null}>
          <WidgetPicker onAdd={addWidget} onClose={() => setPicking(false)} />
        </Suspense>
      ) : null}

      {configuringInstance && configuringDefinition ? (
        <Suspense fallback={null}>
        <WidgetConfigDialog
          definition={configuringDefinition}
          instance={configuringInstance}
          config={parseWidgetConfig(configuringDefinition, configuringInstance.config)}
          size={configuringSize}
          onSizeChange={(name) => resizeInstance(configuringInstance.id, name)}
          onChange={(path, value) =>
            patchInstance(configuringInstance.id, (current) => ({
              ...current,
              config: setPath(current.config, path, value),
            }))
          }
          onSurfaceChange={(surface) =>
            patchInstance(configuringInstance.id, (current) => ({ ...current, surface }))
          }
          onClose={() => setConfiguring(null)}
        />
        </Suspense>
      ) : null}

      {widgets.instances.length === 0 && !picking ? (
        <p className="canvas__empty">
          No widgets yet. Add a clock, the weather, or whatever else belongs on your dashboard.
        </p>
      ) : null}

    </div>
  )
}

/** Renders one instance, resolving its definition and validating its config. */
function WidgetHost({
  instance,
  settings,
  editing,
  onConfigure,
  onRemove,
  onConfigChange,
}: {
  instance: WidgetInstance
  settings: Settings
  editing: boolean
  onConfigure: () => void
  onRemove: () => void
  onConfigChange: (path: string, value: unknown) => void
}) {
  const definition = getWidget(instance.type)

  if (!definition) {
    return (
      <WidgetFrame
        title="Unknown widget"
        icon="warning"
        surface={instance.surface ?? settings.appearance.surface}
        editing={editing}
        hasConfig={false}
        onConfigure={onConfigure}
        onRemove={onRemove}
      >
        <p className="wframe__missing">
          This widget type (<code>{instance.type}</code>) is not available in this version.
        </p>
      </WidgetFrame>
    )
  }

  const config = parseWidgetConfig(definition, instance.config)
  const sizeName = sizeNameOf(instance, definition, settings.widgets.layouts.lg)
  const size = sizeOf(sizeName)

  return (
    <WidgetFrame
      title={definition.name}
      icon={definition.icon}
      surface={instance.surface ?? settings.appearance.surface}
      editing={editing}
      hasConfig={Boolean(definition.fields?.length)}
      onConfigure={onConfigure}
      onRemove={onRemove}
    >
      <definition.Component
        config={config as never}
        setConfig={(changes) => {
          for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
            onConfigChange(key, value)
          }
        }}
        instanceId={instance.id}
        size={size}
        sizeName={sizeName}
      />
    </WidgetFrame>
  )
}

/**
 * The cell grid shown while arranging.
 *
 * One rounded slot per cell, tiled by an SVG pattern so it fills whatever
 * height the canvas has without anyone counting rows. The tile is the cell
 * pitch and the slot is the cell, which is exactly how the grid positions a
 * widget — so a slot is literally where the widget will land.
 */
function GridSlots({ cell, gutter, radius }: { cell: number; gutter: number; radius: number }) {
  // `useId` includes colons, which a url(#...) reference cannot carry.
  const id = `slots${useId().replace(/:/g, '')}`
  const pitch = cell + gutter
  return (
    <svg className="canvas__slots" aria-hidden="true">
      <defs>
        <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <rect
            className="canvas__slot"
            x="0.5"
            y="0.5"
            width={Math.max(0, cell - 1)}
            height={Math.max(0, cell - 1)}
            rx={Math.min(radius, cell / 2)}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * The corner grabber.
 *
 * Replaces the library's default handle, which is an invisible hitbox with a
 * background image on it — nothing tells you a widget can be resized. The ref
 * has to reach the element itself for the drag library to bind to it.
 */
const resizeGrabber = (axis: string, ref: Ref<HTMLElement>) => (
  <span
    ref={ref as Ref<HTMLSpanElement>}
    className={`react-resizable-handle react-resizable-handle-${axis} wgrab`}
    title="Drag to resize"
  >
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
      <path
        d="M9 1 1 9M9 5 5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  </span>
)

/**
 * Positions for instances with no stored geometry. They flow left to right
 * below whatever is already placed, wrapping at the edge, which is how a newly
 * added widget lands next to the last one rather than alone on its own row.
 */
function place(
  instances: WidgetInstance[],
  existing: GridItem[],
  columns: number,
): GridItem[] {
  const out: GridItem[] = []
  let x = 0
  let y = existing.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  let tallest = 0

  for (const instance of instances) {
    const definition = getWidget(instance.type)
    const names = definition?.sizes ?? DEFAULT_SIZES
    const preferred = definition?.defaultSize ?? 'medium'
    const size = sizeOf(
      sizesFitting(names, columns).includes(preferred)
        ? preferred
        : snapSize(sizeOf(preferred), names, columns),
    )
    if (x + size.w > columns) {
      x = 0
      y += tallest
      tallest = 0
    }
    out.push({ i: instance.id, x, y, ...size })
    x += size.w
    tallest = Math.max(tallest, size.h)
  }
  return out
}

/** The standard size an instance is currently at, at the widest breakpoint. */
function sizeNameOf(
  instance: WidgetInstance | undefined,
  definition: AnyWidgetDefinition | undefined,
  stored: GridItem[] | undefined,
): WidgetSizeName {
  const names = definition?.sizes ?? DEFAULT_SIZES
  const item = instance ? stored?.find((entry) => entry.i === instance.id) : undefined
  return item ? nameOfSize(item, names) : (definition?.defaultSize ?? 'medium')
}
