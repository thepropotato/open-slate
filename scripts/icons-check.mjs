/**
 * Reports icon registry entries that nothing references.
 *
 * The registry is the app's only Font Awesome import, so an unused entry is
 * bundle weight on a page whose whole job is to paint instantly.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryPath = join(root, 'src/core/icons/registry.ts')
const registry = readFileSync(registryPath, 'utf8')
const map = registry.slice(registry.indexOf('export const icons'), registry.indexOf('} satisfies'))
const keys = [...map.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1])

const sources = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.(ts|tsx)$/.test(entry.name) && !path.includes('core/icons')) sources.push(path)
  }
}
walk(join(root, 'src'))

const haystack = sources.map((file) => readFileSync(file, 'utf8')).join('\n')
const unused = keys.filter((key) => !new RegExp(`['"\`]${key}['"\`]`).test(haystack))

console.log(`${keys.length} icons registered, ${unused.length} unused`)
if (unused.length) {
  console.log(unused.map((key) => `  ${key}`).join('\n'))
  process.exitCode = 1
}
