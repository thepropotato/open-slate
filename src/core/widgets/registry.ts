import type { AnyWidgetDefinition, WidgetDefinition } from './types'

/**
 * Registry of widget kinds.
 *
 * Widgets register themselves at import time, and `features/widgets/index.ts`
 * is the single import that pulls them all in. Order of registration is the
 * order they appear in the picker.
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

/**
 * Parses an instance's stored config through the widget's own schema. A widget
 * that has gained fields since the config was written gets their defaults, and
 * a corrupted value degrades to defaults instead of throwing during render.
 */
export function parseWidgetConfig(
  definition: AnyWidgetDefinition,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = definition.configSchema.safeParse(stored)
  if (parsed.success) return parsed.data as Record<string, unknown>
  const fallback = definition.configSchema.safeParse({})
  return fallback.success ? (fallback.data as Record<string, unknown>) : {}
}
