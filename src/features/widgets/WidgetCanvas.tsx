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
 * The smallest a cell may get before the canvas stops trying to show the
 * reader's arrangement at all.
 *
 * There is no middle ground any more — no intermediate column counts, no
 * squeezing, no centring. Either the layout fits at a legible size and is shown
 * exactly as arranged, or the window is too narrow and everything stacks into
 * one column. Two outcomes, and the width decides which.
 */
const MIN_CELL = 120

/**
 * How much of a narrow band the stack takes, leaving the rest as side margin.
 *
 * A stacked widget does not need the whole window: at full bleed it runs edge
 * to edge against the browser frame and reads as a wall rather than a column of
 * cards. Holding it to most of the band keeps the cards distinct and gives the
 * eye somewhere to rest either side.
 */
const STACK_WIDTH = 0.86

/**
 * A stacked row's height, as a share of the stack's width.
 *
 * Cells are square, so a one-column band would otherwise make every widget as
 * tall as it is wide — a full-width square per widget, and two of them fill the
 * screen. This is the aspect a stacked card is given instead: taller than the
 * unstacked cell, which is what made them letterboxes, but well short of square.
 */
const STACK_ROW = 0.52

/** Empty rows kept below the last widget while the canvas is unlocked. */
const EDIT_ROOM_ROWS = 1

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
 * One stored arrangement, shown as arranged whenever it fits and as a plain
 * vertical stack when the window is too narrow for it. Dragging and resizing
 * are off until the canvas is unlocked — a dashboard you can knock out of shape
 * by mis-clicking is worse than a fixed one.
 */
export function WidgetCanvas() {
  const settings = useSettings()
  const { update } = useSettingsActions()
  const { widgets, appearance } = settings

  const [picking, setPicking] = useState(false)
  const [configuring, setConfiguring] = useState<string | null>(null)

  /*
   * The grid positions items with percentages on its very first render and
   * switches to CSS transforms once it has mounted and measured the container.
   * Both of those are transitioned properties, so the switch animates every
   * widget from the grid's origin into place — the "thrown from the corner"
   * effect. Nothing is animated until this flag clears on the frame after
   * mount, so the first paint is simply the finished layout; drag and resize
   * keep their motion because by then it is long since settled.
   */
  const [settling, setSettling] = useState(true)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettling(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  const editing = !widgets.locked

  const cols = widgets.columns

  /*
   * `measureBeforeMount` reports the container as unmounted until it has been
   * measured. Without it the hook assumes a 1280px container, so the first
   * layout is computed at the wrong scale and every widget then jumps to its
   * real geometry once the true width arrives — the motion that read as the
   * widgets being thrown into place. The ref goes on the stage rather than the
   * grid, since the grid is what gets held back and the element being measured
   * has to stay in the DOM.
   */
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true })

  /** One cell and the n-1 gutters between them, as the grid divides the band. */
  const cellAt = (columns: number) => (width - widgets.margin * (columns - 1)) / columns

  /**
   * Whether the window is too narrow to show the arrangement.
   *
   * The only question the width is asked. Above this the layout renders exactly
   * as arranged; below it, everything stacks. Arranging always uses the real
   * grid, because a drag has to land the widget in the cell under the cursor.
   */
  const stacked = !editing && width > 0 && cellAt(cols) < MIN_CELL

  /** Columns actually rendered: the whole band when stacked, else the layout's. */
  const activeCols = stacked ? 1 : cols

  /**
   * How wide the stack is, and how much is left over as margin.
   *
   * A stacked widget spanning the full band is a very wide, very short box —
   * the row height still comes from the unstacked cell, which on a narrow
   * window is small, so a clock ends up a letterbox. Holding the stack to a
   * share of the band gives it back some of its proportions and puts the
   * remainder either side as breathing room.
   */
  const stackWidth = stacked ? Math.max(MIN_CELL, width * STACK_WIDTH) : width
  const stackInset = stacked ? (width - stackWidth) / 2 : 0

  /**
   * Row height, which is the cell size — cells are square.
   *
   * Stacked, the band is one column wide, so a square cell would be as tall as
   * the stack is wide. That is far too tall for a one-cell widget, so the
   * stacked row is a share of its width instead: still taller than the flat
   * box the unstacked cell produced, without turning every widget into a
   * square the height of the screen.
   */
  const rowHeight =
    width > 0
      ? Math.max(48, stacked ? stackWidth * STACK_ROW : cellAt(cols))
      : MIN_CELL

  /** Standard sizes each instance is allowed to take, by instance id. */
  const allowed = useMemo(() => {
    const map = new Map<string, readonly WidgetSizeName[]>()
    for (const instance of widgets.instances) {
      map.set(instance.id, getWidget(instance.type)?.sizes ?? DEFAULT_SIZES)
    }
    return map
  }, [widgets.instances])

  /** Brings a layout into a state the canvas can render. */
  const normalize = useCallback(
    (items: readonly GridItem[]) =>
      normalizeLayout(items, cols, (id) => allowed.get(id), widgets.compact),
    [allowed, cols, widgets.compact],
  )

  /**
   * The stored arrangement, with any newly added widget placed into it.
   *
   * `place` positions a widget that has no position yet; everything else keeps
   * exactly the geometry it was stored with.
   */
  const layout = useMemo(() => {
    const known = new Set(widgets.instances.map((i) => i.id))
    const items = widgets.layout.filter((item) => known.has(item.i))
    const missing = widgets.instances.filter((i) => !items.some((item) => item.i === i.id))
    return normalize([...items, ...place(missing, items, cols)])
  }, [widgets.layout, widgets.instances, cols, normalize])

  /**
   * What the grid actually renders.
   *
   * Either the layout as arranged, or a single column of it. Stacking is
   * derived here and never written back — `onLayoutChange` refuses to store
   * anything while stacked — which is what lets widening the window bring the
   * arrangement back exactly as it was.
   */
  const shown = useMemo(
    () => (stacked ? stackVertically(layout, 1) : layout),
    [layout, stacked],
  )

  /**
   * How tall the canvas is while arranging.
   *
   * An empty row past the last widget, so there is somewhere below to drag one
   * to. Without it the canvas ends flush with the bottom widget and the only
   * way to make a new row is to drop onto an existing one.
   */
  const rows = useMemo(
    () => layout.reduce((max, item) => Math.max(max, item.y + item.h), 0),
    [layout],
  )

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

  /** Stores a layout the reader has actually rearranged. */
  const onLayoutChange = useCallback(
    (next: Layout) => {
      /*
       * Only a real rearrangement is stored. The grid emits a layout whenever
       * it re-measures, a window resize included, and writing that back is what
       * used to replace the reader's arrangement with one nobody had chosen —
       * a narrow window would flatten it to a single column, on disk, past a
       * reload. Arranging is the only thing that changes what is stored.
       *
       * `stacked` is redundant today, since it implies `!editing` and so cannot
       * be reached on its own. It is kept because it states the rule the canvas
       * actually relies on: a derived layout is never written back.
       */
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

  /**
   * Applies a standard size to an instance.
   *
   * Growing a widget is the one change that cannot be made in place: whatever
   * used to sit beside or below it has to move, which is what `normalize` does.
   */
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
        /*
         * The whole widget drags, not a 22px grip — a target that small was
         * easy to miss and easy to hit by accident. Widgets keep their own
         * inputs usable because dragging is only on while the canvas is
         * unlocked, and the frame's own buttons are excluded outright.
         *
         * `.wframe__live` marks content that may still be scrolled while
         * arranging — a first-run card longer than its widget. It is excluded
         * from the drag handle so the wheel reaches it; its children stay
         * inert, so scrolling is all it gets.
         */
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
