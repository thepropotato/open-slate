import { isExtension } from '@/core/platform/browser'
import { Tile, type Tile as TileModel } from '@/core/settings/schema'
import { uid } from '@/core/util/id'

// First-run tiles: the browser's most-visited list, topped up from a small
// fallback set for fresh profiles that have none.

const FALLBACK: Array<[url: string, title: string]> = [
  ['https://mail.google.com', 'Gmail'],
  ['https://www.youtube.com', 'YouTube'],
  ['https://github.com', 'GitHub'],
  ['https://www.google.com/maps', 'Maps'],
  ['https://calendar.google.com', 'Calendar'],
  ['https://drive.google.com', 'Drive'],
  ['https://www.reddit.com', 'Reddit'],
  ['https://en.wikipedia.org', 'Wikipedia'],
]

const MAX_SEEDED = 10

const makeTile = (url: string, title: string): TileModel =>
  Tile.parse({ id: uid('tile'), url, title })

export async function seedTilesFromBrowser(): Promise<TileModel[]> {
  const sites = await readTopSites()
  const seen = new Set(sites.map(([url]) => normalise(url)))
  const topUp = FALLBACK.filter(([url]) => !seen.has(normalise(url)))
  return [...sites, ...topUp].slice(0, MAX_SEEDED).map(([url, title]) => makeTile(url, title))
}

async function readTopSites(): Promise<Array<[string, string]>> {
  if (!isExtension() || !chrome.topSites?.get) return []
  try {
    const sites = await chrome.topSites.get()
    return sites
      .filter((site) => /^https?:/.test(site.url))
      .map((site) => [site.url, site.title || ''] as [string, string])
  } catch {
    return []
  }
}

/** Used by the "add top sites" action, skipping anything already pinned. */
export async function topSitesNotIn(existing: TileModel[]): Promise<TileModel[]> {
  const have = new Set(existing.map((t) => normalise(t.url)))
  const sites = await readTopSites()
  return sites
    .filter(([url]) => !have.has(normalise(url)))
    .map(([url, title]) => makeTile(url, title))
}

const normalise = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '')
  } catch {
    return url
  }
}
