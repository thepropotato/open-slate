import { localStore } from '@/core/platform/browser'
import { dominantColor } from '@/core/theme/color'

/**
 * Brand-logo resolution for tiles: Simple Icons for the curated host list in
 * `scripts/brand-domains.mjs`, otherwise the site's own favicon tinted by its
 * dominant colour. The dataset loads lazily; tiles upgrade in place.
 */

export interface Brand {
  slug: string
  title: string
  hex: string
  /** SVG path data on a 24x24 viewBox. */
  path: string
}

interface BrandData {
  icons: Record<string, [title: string, hex: string, path: string]>
  domains: Record<string, string>
}

let dataPromise: Promise<BrandData> | null = null

const loadBrandData = (): Promise<BrandData> => {
  // The JSON's inferred type widens tuples to string[], hence the assertion.
  dataPromise ??= import('@/generated/brands.json').then((m) => m.default as unknown as BrandData)
  return dataPromise
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Tries the full host, then drops one subdomain label at a time. */
function lookupHost(domains: Record<string, string>, host: string): string | undefined {
  const labels = host.split('.')
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join('.')
    if (domains[candidate]) return domains[candidate]
  }
  return undefined
}

export async function resolveBrand(url: string, explicitSlug = ''): Promise<Brand | null> {
  const data = await loadBrandData()
  const slug = explicitSlug || lookupHost(data.domains, hostOf(url))
  if (!slug) return null
  const entry = data.icons[slug]
  if (!entry) return null
  return { slug, title: entry[0], hex: entry[1], path: entry[2] }
}

/** Every curated brand, for the picker in the tile editor. */
export async function allBrands(): Promise<Brand[]> {
  const data = await loadBrandData()
  return Object.entries(data.icons)
    .map(([slug, [title, hex, path]]) => ({ slug, title, hex, path }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

const TINT_KEY = 'faviconTints'
const memoryTints = new Map<string, string | null>()
let storedTints: Record<string, string> | null = null
let pendingWrite: ReturnType<typeof setTimeout> | null = null

// Cached by host in storage: the sample costs a canvas read and never changes.
export async function faviconTint(host: string, faviconSrc: string): Promise<string | null> {
  if (!host || !faviconSrc) return null
  if (memoryTints.has(host)) return memoryTints.get(host) ?? null

  storedTints ??= (await localStore.get<Record<string, string>>(TINT_KEY)) ?? {}
  if (storedTints[host]) {
    memoryTints.set(host, storedTints[host])
    return storedTints[host]
  }

  const colour = await dominantColor(faviconSrc)
  memoryTints.set(host, colour)
  if (colour) {
    storedTints[host] = colour
    // Batch writes: a grid of tiles resolves all at once on first load.
    if (pendingWrite) clearTimeout(pendingWrite)
    pendingWrite = setTimeout(() => void localStore.set(TINT_KEY, storedTints), 400)
  }
  return colour
}

/** Initials for the monogram fallback: "news.ycombinator.com" -> "YC". */
export function monogram(url: string, title = ''): string {
  const source = title.trim() || hostOf(url).split('.')[0] || '?'
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}
