import type { ComponentType } from 'react'
import type { ZodType } from 'zod'
import type { IconName } from '@/core/icons'
import type { OptionalPermission } from '@/core/platform/browser'
import type { Field } from '@/features/settings-ui/types'
import type { WidgetSize, WidgetSizeName } from './sizes'

export type { WidgetSize, WidgetSizeName }

export interface WidgetProps<Config> {
  config: Config
  setConfig: (changes: Partial<Config>) => void
  instanceId: string
  size: WidgetSize
  sizeName: WidgetSizeName
}

/** Everything the app needs to know about one kind of widget; adding one touches no code outside its directory. */
export interface WidgetDefinition<Config = Record<string, unknown>> {
  type: string
  name: string
  description: string
  icon: IconName
  configSchema: ZodType<Config>
  // Every widget snaps to one of these; there is no free-form resizing.
  sizes: readonly WidgetSizeName[]
  defaultSize: WidgetSizeName
  // Requested when the widget is first added.
  permissions?: OptionalPermission[]
  origins?: string[]
  Component: ComponentType<WidgetProps<Config>>
  // Paths are relative to the instance config, e.g. `style` not `widgets.instances[0].style`.
  fields?: Field[]
}

/** Erased form used by the registry, which cannot know each Config type. */
export type AnyWidgetDefinition = WidgetDefinition<never>
