import type { SetupGuide } from './types'

/**
 * Guides register themselves at import time, the same way widgets do, so adding
 * one means adding a module rather than editing a central switch.
 */
const guides = new Map<string, SetupGuide>()

export function registerGuide(guide: SetupGuide): void {
  guides.set(guide.id, guide)
}

export const getGuide = (id: string | null): SetupGuide | undefined =>
  id === null ? undefined : guides.get(id)

export const allGuides = (): SetupGuide[] => [...guides.values()]

/** The page a guide's own "set this up" entry point should open. */
export const guideUrl = (id: string): string => `/setup.html?guide=${encodeURIComponent(id)}`
