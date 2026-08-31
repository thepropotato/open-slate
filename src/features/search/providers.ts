import { faviconUrl, isExtension, permissions, type OptionalPermission } from '@/core/platform/browser'
import type { IconName } from '@/core/icons'
import type { Tile } from '@/core/settings/schema'

/**
 * Local suggestion sources: open tabs, bookmarks, history and the user's tiles.
 * Deliberately no remote suggestion service — no keystrokes leave the page.
 */

export type SuggestionKind = 'tab' | 'bookmark' | 'history' | 'tile' | 'search' | 'action'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  title: string
  subtitle?: string
  url?: string
  image?: string
  icon?: IconName
  /** Higher sorts first. */
  score: number
  run: () => void | Promise<void>
}

export const PROVIDER_PERMISSIONS: Record<'tabs' | 'bookmarks' | 'history', OptionalPermission[]> = {
  tabs: ['tabs'],
  bookmarks: ['bookmarks'],
  history: ['history'],
}

export interface ProviderOptions {
  limit?: number
  tiles?: Tile[]
  sources?: Array<'tab' | 'bookmark' | 'history' | 'tile'>
}

const DEFAULT_SOURCES: NonNullable<ProviderOptions['sources']> = ['tab', 'tile', 'bookmark', 'history']

export async function queryLocal(query: string, options: ProviderOptions = {}): Promise<Suggestion[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const sources = options.sources ?? DEFAULT_SOURCES
  const limit = options.limit ?? 8

  const groups = await Promise.all([
    sources.includes('tab') ? openTabs(needle) : [],
    sources.includes('tile') ? matchTiles(needle, options.tiles ?? []) : [],
    sources.includes('bookmark') ? bookmarks(needle) : [],
    sources.includes('history') ? history(needle) : [],
  ])

  return dedupe(groups.flat())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Highest-scoring entry per URL, so a bookmarked open tab appears once.
function dedupe(items: Suggestion[]): Suggestion[] {
  const best = new Map<string, Suggestion>()
  for (const item of items) {
    const key = item.url ? normalise(item.url) : item.id
    const existing = best.get(key)
    if (!existing || item.score > existing.score) best.set(key, item)
  }
  return [...best.values()]
}

const normalise = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.host.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '') + parsed.search
  } catch {
    return url
  }
}

// A title prefix beats a title substring, which beats a URL-only match.
function relevance(needle: string, title: string, url: string): number {
  const lowerTitle = title.toLowerCase()
  const lowerUrl = url.toLowerCase()
  if (lowerTitle.startsWith(needle)) return 100
  if (lowerTitle.includes(` ${needle}`)) return 80
  if (lowerTitle.includes(needle)) return 65
  if (lowerUrl.includes(`//${needle}`) || lowerUrl.includes(`//www.${needle}`)) return 60
  if (lowerUrl.includes(needle)) return 35
  return 0
}

async function openTabs(needle: string): Promise<Suggestion[]> {
  if (!isExtension() || !(await permissions.has(['tabs']))) return []
  try {
    const tabs = await chrome.tabs.query({})
    return tabs
      .filter((tab) => tab.id !== undefined && tab.url)
      .map((tab) => {
        const title = tab.title || tab.url || ''
        const score = relevance(needle, title, tab.url ?? '')
        return { tab, title, score }
      })
      .filter((entry) => entry.score > 0)
      .map(({ tab, title, score }) => ({
        id: `tab:${tab.id}`,
        kind: 'tab' as const,
        title,
        subtitle: hostLabel(tab.url ?? ''),
        url: tab.url,
        image: faviconUrl(tab.url ?? '', 32),
        icon: 'tabs' as IconName,
        // Switching to an open tab is almost always better than opening a copy.
        score: score + 25,
        run: async () => {
          if (tab.id === undefined) return
          await chrome.tabs.update(tab.id, { active: true })
          if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
        },
      }))
  } catch {
    return []
  }
}

async function bookmarks(needle: string): Promise<Suggestion[]> {
  if (!isExtension() || !(await permissions.has(['bookmarks']))) return []
  try {
    const results = await chrome.bookmarks.search({ query: needle })
    return results
      .filter((node) => node.url)
      .map((node) => ({
        id: `bookmark:${node.id}`,
        kind: 'bookmark' as const,
        title: node.title || node.url || '',
        subtitle: hostLabel(node.url ?? ''),
        url: node.url,
        image: faviconUrl(node.url ?? '', 32),
        icon: 'bookmark' as IconName,
        score: relevance(needle, node.title || '', node.url ?? '') + 10,
        run: () => navigate(node.url ?? ''),
      }))
      .filter((item) => item.score > 10)
  } catch {
    return []
  }
}

async function history(needle: string): Promise<Suggestion[]> {
  if (!isExtension() || !(await permissions.has(['history']))) return []
  try {
    const results = await chrome.history.search({ text: needle, maxResults: 20 })
    return results
      .filter((item) => item.url)
      .map((item) => ({
        id: `history:${item.id}`,
        kind: 'history' as const,
        title: item.title || item.url || '',
        subtitle: hostLabel(item.url ?? ''),
        url: item.url,
        image: faviconUrl(item.url ?? '', 32),
        icon: 'history' as IconName,
        // Frequently visited pages surface above one-off visits.
        score: relevance(needle, item.title || '', item.url ?? '') + Math.min(15, item.visitCount ?? 0),
        run: () => navigate(item.url ?? ''),
      }))
      .filter((item) => item.score > 0)
  } catch {
    return []
  }
}

function matchTiles(needle: string, tiles: Tile[]): Suggestion[] {
  return tiles
    .map((tile) => ({
      tile,
      score: relevance(needle, tile.title || '', tile.url),
    }))
    .filter((entry) => entry.score > 0)
    .map(({ tile, score }) => ({
      id: `tile:${tile.id}`,
      kind: 'tile' as const,
      title: tile.title || hostLabel(tile.url),
      subtitle: hostLabel(tile.url),
      url: tile.url,
      image: faviconUrl(tile.url, 32),
      icon: 'star' as IconName,
      score: score + 15,
      run: () => navigate(tile.url),
    }))
}

export const hostLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const navigate = (url: string) => {
  if (url) window.location.assign(url)
}
