/**
 * Builds `src/generated/brands.json` from the `simple-icons` dev dependency.
 *
 * Output shape:
 *   { icons: { slug: [title, hex, path] }, domains: { host: slug } }
 *
 * Tuples rather than objects keep the file small. `simple-icons` stays a dev
 * dependency - nothing imports it at runtime.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as simpleIcons from 'simple-icons'
import { brandDomains } from './brand-domains.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../src/generated/brands.json')

const bySlug = new Map()
for (const icon of Object.values(simpleIcons)) {
  if (icon && typeof icon === 'object' && 'slug' in icon) bySlug.set(icon.slug, icon)
}

const icons = {}
const domains = {}
const missing = []

for (const [host, explicitSlug] of Object.entries(brandDomains)) {
  const slug = explicitSlug ?? host.split('.')[0]
  const icon = bySlug.get(slug)
  if (!icon) {
    missing.push(`${host} -> ${slug}`)
    continue
  }
  domains[host] = slug
  icons[slug] ??= [icon.title, `#${icon.hex.toLowerCase()}`, icon.path]
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify({ icons, domains }))

const bytes = JSON.stringify({ icons, domains }).length
console.log(`brands.json: ${Object.keys(icons).length} icons, ${Object.keys(domains).length} domains, ${(bytes / 1024).toFixed(0)}KB`)
// Unresolved entries are expected: see `unavailableBrands` in brand-domains.mjs.
if (missing.length) {
  console.warn(`\n${missing.length} curated hosts have no Simple Icon; they use the favicon plate:`)
  for (const line of missing) console.warn('  ' + line)
}
