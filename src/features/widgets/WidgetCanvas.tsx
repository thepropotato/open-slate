import { Suspense, useCallback, useEffect, useId, useMemo, useState, type Ref } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import {
  GridLayout,
  horizontalCompactor,
  useContainerWidth,
  verticalCompactor,
  type Layout,
} from 'react-grid-layout'
import { gridBounds, type LayoutConstraint } from 'react-grid-layout/core'
import { Icon } from '@/core/icons'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { WidgetInstance, type GridItem, type Settings } from '@/core/settings/schema'
import { getWidget, parseWidgetConfig } from '@/core/widgets/registry'
import { freeCompactor, normalizeLayout, stackVertically } from '@/core/widgets/layout'
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

// Lazy: the config dialog pulls in the settings-UI field renderer, which would
// otherwise land in the new tab's first paint.
const WidgetPicker = lazyChunk(() => import('./WidgetPicker').then((m) => ({ default: m.WidgetPicker })))
const WidgetConfigDialog = lazyChunk(() =>
  import('./WidgetConfigDialog').then((m) => ({ default: m.WidgetConfigDialog })),
)
import 'react-grid-layout/css/styles.css'
import './widgets.css'

// Cell size assumed before the stage has been measured, and the narrowest a
// stacked column is allowed to get.
const MIN_CELL = 120

// Below this width the arrangement is abandoned for a single stacked column.
// There is no in-between: it either fits as arranged or it stacks.
//
// A board is measured by its total width, not by its cell size. Cells shrink as
// `columns` rises, so a per-cell floor would stack a 9- or 10-column board at
// every ordinary window width while leaving a 4-column one alone - the widgets
// are the same size either way, there are just more slots to place them in.
const MIN_BOARD = 640

// Share of a narrow band the stack takes; the rest is side margin.
const STACK_WIDTH = 0.86

// Stacked row height as a share of stack width. Cells are square, so without
// this a one-column band would make every widget as tall as the window is wide.
const STACK_ROW = 0.52

// Empty rows kept below the last widget while unlocked, as a drop target.
const EDIT_ROOM_ROWS = 1

const COMPACTORS = {
  vertical: verticalCompactor,
  horizontal: horizontalCompactor,
  // Not the library's `noCompactor`: that one lets a growing widget overlap
  // its neighbours. See `layout.ts`.
  none: freeCompactor,
}

// One stored arrangement, rendered as arranged when it fits and as a vertical
// stack when the window is too narrow. Drag and resize require unlocking.
export function WidgetCanvas() {
  const settings = useSettings()
  const { update } = useSettingsActions()
  const { widgets, appearance } = settings

  const [picking, setPicking] = useState(false)
  const [configuring, setConfiguring] = useState<string | null>(null)

  // Animation stays off until the frame after mount, or every widget flies in
  // from the origin: the grid positions with percentages before mount and
  // transforms after, and the library's stylesheet transitions both.
  const [settling, setSettling] = useState(true)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettling(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  const editing = !widgets.locked

  const cols = widgets.columns

  // Without `measureBeforeMount` the hook assumes 1280px and every widget jumps
  // once the real width arrives. The ref goes on the stage, not the grid, since
  // the grid is what is held back and the measured element must stay mounted.
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true })

  const cellAt = (columns: number) => (width - widgets.margin * (columns - 1)) / columns

  // Arranging never stacks: a drag has to land in the cell under the cursor.
  const stacked = !editing && width > 0 && width < MIN_BOARD

  const activeCols = stacked ? 1 : cols

  const stackWidth = stacked ? Math.max(MIN_CELL, width * STACK_WIDTH) : width
  const stackInset = stacked ? (width - stackWidth) / 2 : 0

  // Cells are square, so unstacked the row height is the cell size; stacked it
  // is a share of the stack width instead of a full-width square.
  const rowHeight =
    width > 0
      ? Math.max(48, stacked ? stackWidth * STACK_ROW : cellAt(cols))
      : MIN_CELL

  const allowed = useMemo(() => {
    const map = new Map<string, readonly WidgetSizeName[]>()
    for (const instance of widgets.instances) {
      map.set(instance.id, getWidget(instance.type)?.sizes ?? DEFAULT_SIZES)
    }
    return map
  }, [widgets.instances])

  const normalize = useCallback(
    (items: readonly GridItem[]) =>
      normalizeLayout(items, cols, (id) => allowed.get(id), widgets.compact),
    [allowed, cols, widgets.compact],
  )

  // The stored arrangement; `place` only positions widgets that have no geometry.
  const layout = useMemo(() => {
    const known = new Set(widgets.instances.map((i) => i.id))
    const items = widgets.layout.filter((item) => known.has(item.i))
    const missing = widgets.instances.filter((i) => !items.some((item) => item.i === i.id))
    return normalize([...items, ...place(missing, items, cols)])
  }, [widgets.layout, widgets.instances, cols, normalize])

  // Stacking is derived here and never written back, so widening the window
  // restores the arrangement exactly.
  const shown = useMemo(
    () => (stacked ? stackVertically(layout, 1) : layout),
    [layout, stacked],
  )

  const rows = useMemo(
    () => layout.reduce((max, item) => Math.max(max, item.y + item.h), 0),
    [layout],
  )

  const stageHeight = (rows + EDIT_ROOM_ROWS) * (rowHeight + widgets.margin) - widgets.margin

  // Resizing snaps to the widget's declared standard sizes, not single cells.
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
    (next: Layout) => {
      // The grid re-emits a layout on every re-measure, a window resize
      // included; storing those would persist the stacked column. A derived
      // layout is never written back (`stacked` is redundant but states the rule).
      if (!editing || stacked) return

      // Store only the geometry, dropping the library's transient item flags.
      const geometry = next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
      const normalized = normalize(geometry)
      update((current) => {
        // The grid emits a layout on entering arrange mode too; skip no-ops.
        if (JSON.stringify(current.widgets.layout) === JSON.stringify(normalized)) return current
        return { ...current, widgets: { ...current.widgets, layout: normalized } }
      })
    },
    [update, normalize, editing, stacked],
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
        layout: current.widgets.layout.filter((item) => item.i !== id),
      },
    }))

  // Growing a widget moves its neighbours, which is what `normalize` handles.
  const resizeInstance = (id: string, name: WidgetSizeName) =>
    update((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        layout: normalize(
          current.widgets.layout.map((item) =>
            item.i === id ? { ...item, ...sizeOf(name) } : item,
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
  const configuringSize = sizeNameOf(configuringInstance, configuringDefinition, widgets.layout)

  return (
    <div className="canvas" data-editing={editing} data-settling={settling}>
      <div
        className="canvas__stage"
        ref={containerRef}
        style={{ minHeight: editing ? stageHeight : undefined }}
      >
      <GridSlots cell={rowHeight} gutter={widgets.margin} radius={appearance.radius} />
      {mounted ? (
      <GridLayout
        className="canvas__grid"
        // Indented into the middle of the band when stacked; flush otherwise.
        style={stackInset > 0 ? { marginInline: stackInset } : undefined}
        width={stackWidth}
        layout={shown}
        gridConfig={{
          cols: activeCols,
          rowHeight,
          margin: [widgets.margin, widgets.margin],
          containerPadding: [0, 0],
        }}
        compactor={COMPACTORS[widgets.compact]}
        constraints={constraints}
        // The whole widget is the drag handle. `.wframe__live` marks content
        // that must stay scrollable while arranging, so it is excluded.
        dragConfig={{
          enabled: editing,
          handle: '.wframe',
          cancel: '.wframe__tool, .wframe__live, .react-resizable-handle',
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
      </GridLayout>
      ) : null}
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
  const sizeName = sizeNameOf(instance, definition, settings.widgets.layout)
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

// Cell grid shown while arranging: an SVG pattern at the cell pitch, so it
// fills any canvas height without counting rows.
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

// Replaces the library's invisible default resize handle. The ref must reach
// the element itself for the drag library to bind to it.
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

// Positions for instances with no stored geometry: left to right below whatever
// is already placed, wrapping at the edge.
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

function sizeNameOf(
  instance: WidgetInstance | undefined,
  definition: AnyWidgetDefinition | undefined,
  stored: GridItem[] | undefined,
): WidgetSizeName {
  const names = definition?.sizes ?? DEFAULT_SIZES
  const item = instance ? stored?.find((entry) => entry.i === instance.id) : undefined
  return item ? nameOfSize(item, names) : (definition?.defaultSize ?? 'medium')
}
