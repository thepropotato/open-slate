import { localStore, permissions } from '@/core/platform/browser'
import { parseFeed, type FeedItem } from './parse'

// Feed fetching. Each feed's origin is an optional host permission, so the
// extension never holds blanket network access.

const CACHE_KEY = 'feedCache'
const CACHE_TTL_MS = 15 * 60 * 1000

interface CacheEntry {
  at: number
  title: string
  items: FeedItem[]
}

export const originOf = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol)) return null
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

export const hasFeedAccess = (url: string): Promise<boolean> => {
  const origin = originOf(url)
  return origin ? permissions.has([], [origin]) : Promise.resolve(false)
}

export const requestFeedAccess = (url: string): Promise<boolean> => {
  const origin = originOf(url)
  return origin ? permissions.request([], [origin]) : Promise.resolve(false)
}

export interface LoadedFeed {
  url: string
  title: string
  items: FeedItem[]
  /** Set when the feed could not be read. */
  error?: string
}

export async function loadFeeds(urls: string[]): Promise<LoadedFeed[]> {
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  const results: LoadedFeed[] = []
  let cacheChanged = false

  for (const url of urls) {
    const hit = cache[url]
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      results.push({ url, title: hit.title, items: hit.items })
      continue
    }

    if (!(await hasFeedAccess(url))) {
      results.push({ url, title: url, items: hit?.items ?? [], error: 'needs-permission' })
      continue
    }

    try {
      const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const feed = parseFeed(await response.text())
      if (!feed) throw new Error('not a feed')
      cache[url] = { at: Date.now(), title: feed.title, items: feed.items.slice(0, 30) }
      cacheChanged = true
      results.push({ url, title: feed.title, items: cache[url].items })
    } catch (error) {
      // A stale copy beats an empty widget when the network is down.
      results.push({
        url,
        title: hit?.title ?? url,
        items: hit?.items ?? [],
        error: error instanceof Error ? error.message : 'could not load',
      })
    }
  }

  if (cacheChanged) await localStore.set(CACHE_KEY, cache)
  return results
}
