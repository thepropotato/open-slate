import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Widget types, read out of the sources rather than by importing the registry:
 * registering a widget imports its React component, and the scripts run under
 * plain Node with no DOM. `check-facts.mjs` reads the same file the same way.
 */
export function knownTypes() {
  const index = readFileSync(join('src', 'features', 'widgets', 'index.ts'), 'utf8')
  const types = new Set()
  for (const [, path] of index.matchAll(/^import '\.\/(.+)'$/gm)) {
    const source = readFileSync(join('src', 'features', 'widgets', `${path}.tsx`), 'utf8')
    const match = /registerWidget(?:<[^>]*>)?\(\{[\s\S]*?type: '([a-z0-9-]+)'/.exec(source)
    if (match) types.add(match[1])
  }
  return types
}
