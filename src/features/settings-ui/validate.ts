import { defaultSettings } from '@/core/settings/schema'
import { getPath } from '@/core/util/path'
import type { Section } from './types'

// Dev-only guard: a typo in a spec dot-path otherwise fails silently, as a
// control reading `undefined` and writing a field nothing consumes.
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
