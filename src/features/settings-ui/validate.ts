import { defaultSettings } from '@/core/settings/schema'
import { getPath } from '@/core/util/path'
import type { Section } from './types'

/**
 * Development-only guard: every dot-path declared in the settings spec must
 * exist in the parsed defaults. Without this, a typo in a path fails silently
 * as a control that reads `undefined` and writes a field nothing consumes.
 */
export function validateSpecPaths(sections: Section[]): string[] {
  const defaults = defaultSettings() as unknown
  const problems: string[] = []
  for (const section of sections) {
    for (const group of section.groups) {
      for (const field of group.fields) {
        if (!field.path) continue
        if (getPath(defaults, field.path) === undefined) {
          problems.push(`${section.id}/${group.id}: unknown settings path "${field.path}"`)
        }
      }
    }
  }
  return problems
}
