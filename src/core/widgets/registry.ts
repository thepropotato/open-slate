import type { AnyWidgetDefinition, WidgetDefinition } from './types'

/**
 * Registry of widget kinds. Widgets register at import time via
 * `features/widgets/index.ts`; registration order is picker order.
 */

const registry = new Map<string, AnyWidgetDefinition>()

export function registerWidget<Config>(definition: WidgetDefinition<Config>): void {
  if (registry.has(definition.type) && import.meta.env.DEV) {
    console.warn(`[widgets] "${definition.type}" registered twice`)
  }
  registry.set(definition.type, definition as unknown as AnyWidgetDefinition)
}

export const getWidget = (type: string): AnyWidgetDefinition | undefined => registry.get(type)

export const allWidgets = (): AnyWidgetDefinition[] => [...registry.values()]

/** Parses stored config through the widget's schema; anything invalid degrades to defaults. */
export function parseWidgetConfig(
  definition: AnyWidgetDefinition,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = definition.configSchema.safeParse(stored)
  if (parsed.success) return parsed.data as Record<string, unknown>
  const fallback = definition.configSchema.safeParse({})
  return fallback.success ? (fallback.data as Record<string, unknown>) : {}
}
