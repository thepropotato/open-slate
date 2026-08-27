import type { ComponentType } from 'react'
import type { ZodType } from 'zod'
import type { IconName } from '@/core/icons'
import type { OptionalPermission } from '@/core/platform/browser'
import type { Field } from '@/features/settings-ui/types'

/** Grid footprint, measured in canvas columns and rows. */
export interface WidgetSize {
  w: number
  h: number
}

export interface WidgetProps<Config> {
  config: Config
  /** Persists a partial config change for this instance. */
  setConfig: (changes: Partial<Config>) => void
  instanceId: string
  /** Current footprint, so a widget can adapt its own density. */
  size: WidgetSize
}

/**
 * Everything the app needs to know about one kind of widget.
 *
 * A widget owns its config schema, its default footprint, its settings fields
 * and the permissions it needs. Nothing outside the widget's own directory has
 * to change to add one — the canvas, the picker and the settings UI all read
 * this definition.
 */
export interface WidgetDefinition<Config = Record<string, unknown>> {
  type: string
  name: string
  description: string
  icon: IconName
  /** Validates and defaults this widget's slice of stored config. */
  configSchema: ZodType<Config>
  defaultSize: WidgetSize
  minSize?: WidgetSize
  maxSize?: WidgetSize
  /** Optional Chrome permissions requested when the widget is first added. */
  permissions?: OptionalPermission[]
  /** Optional host permissions, requested alongside the above. */
  origins?: string[]
  Component: ComponentType<WidgetProps<Config>>
  /**
   * Config fields, declared exactly like global settings. Paths are relative to
   * the instance config, e.g. `style` rather than `widgets.instances[0].style`.
   */
  fields?: Field[]
}

/** Erased form used by the registry, which cannot know each Config type. */
export type AnyWidgetDefinition = WidgetDefinition<never>
