import { useCallback, useMemo, useState } from 'react'
import {
  ResponsiveGridLayout,
  horizontalCompactor,
  noCompactor,
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import { Icon } from '@/core/icons'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { WidgetInstance, type GridItem, type Settings } from '@/core/settings/schema'
import { getWidget, parseWidgetConfig } from '@/core/widgets/registry'
import type { AnyWidgetDefinition } from '@/core/widgets/types'
import { setPath } from '@/core/util/path'
import { uid } from '@/core/util/id'
import { WidgetFrame } from './WidgetFrame'
import { WidgetPicker } from './WidgetPicker'
import { WidgetConfigDialog } from './WidgetConfigDialog'
import 'react-grid-layout/css/styles.css'
import './widgets.css'

const BREAKPOINTS = { lg: 1080, md: 760, sm: 0 }

const COMPACTORS = {
  vertical: verticalCompactor,
  horizontal: horizontalCompactor,
  none: noCompactor,
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
  const { widgets } = settings

  const [picking, setPicking] = useState(false)
  const [configuring, setConfiguring] = useState<string | null>(null)

  const editing = !widgets.locked

  const cols = useMemo(
    () => ({
      lg: widgets.columns,
      md: widgets.columns,
      sm: Math.max(4, Math.round(widgets.columns / 2)),
    }),
    [widgets.columns],
  )

  const { width, containerRef } = useContainerWidth()

  const layouts = useMemo<ResponsiveLayouts<string>>(() => {
    const stored = widgets.layouts as Record<string, GridItem[]>
    const known = new Set(widgets.instances.map((i) => i.id))
    const out: Record<string, GridItem[]> = {}
    for (const key of Object.keys(BREAKPOINTS)) {
      const items = (stored[key] ?? []).filter((item) => known.has(item.i))
      // Anything without a stored position gets appended below the rest.
      const missing = widgets.instances.filter((i) => !items.some((item) => item.i === i.id))
      const bottom = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      out[key] = [
        ...items,
        ...missing.map((instance, index) => {
          const definition = getWidget(instance.type)
          const size = definition?.defaultSize ?? { w: 6, h: 4 }
          return { i: instance.id, x: 0, y: bottom + index * size.h, ...size }
        }),
      ]
    }
    return out
  }, [widgets.layouts, widgets.instances])

  const onLayoutChange = useCallback(
    (_current: Layout, all: ResponsiveLayouts<string>) => {
      const next: Record<string, GridItem[]> = {}
      for (const [key, items] of Object.entries(all)) {
        // Store only the geometry, dropping the library's transient item flags.
        next[key] = (items ?? []).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
      }
      update((current) => {
        // The grid emits a layout on mount as well; skip identical writes.
        if (JSON.stringify(current.widgets.layouts) === JSON.stringify(next)) return current
        return { ...current, widgets: { ...current.widgets, layouts: next } }
      })
    },
    [update],
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

  return (
    <div className="canvas" data-editing={editing}>
      <ResponsiveGridLayout
        className="canvas__grid"
        innerRef={containerRef}
        width={width}
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={cols}
        rowHeight={widgets.rowHeight}
        margin={[widgets.margin, widgets.margin]}
        containerPadding={[0, 0]}
        compactor={COMPACTORS[widgets.compact]}
        // Dragging is limited to the frame's grip so widgets with their own
        // inputs stay usable, and only while the canvas is unlocked.
        dragConfig={{ enabled: editing, handle: '.wframe__drag', bounded: false, threshold: 3 }}
        resizeConfig={{ enabled: editing, handles: ['se'] }}
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

      {picking ? <WidgetPicker onAdd={addWidget} onClose={() => setPicking(false)} /> : null}

      {configuringInstance && configuringDefinition ? (
        <WidgetConfigDialog
          definition={configuringDefinition}
          instance={configuringInstance}
          config={parseWidgetConfig(configuringDefinition, configuringInstance.config)}
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
  const size =
    (settings.widgets.layouts.lg ?? []).find((item) => item.i === instance.id) ??
    definition.defaultSize

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
        size={{ w: size.w, h: size.h }}
      />
    </WidgetFrame>
  )
}
