import type { Suggestion } from '@/features/search/providers'

/** The last few things opened from the palette, kept in this browser so an empty palette has something useful to show. */
const KEY = 'open-slate:palette-recent'
const MAX = 5

export type Recent = Pick<Suggestion, 'kind' | 'title' | 'subtitle' | 'url' | 'image'>

export function loadRecent(): Recent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Recent[]).filter((item) => item?.url).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushRecent(item: Suggestion): void {
  if (!item.url || item.kind === 'search' || item.kind === 'action') return
  const entry: Recent = { kind: item.kind, title: item.title, subtitle: item.subtitle, url: item.url, image: item.image }
  try {
    const next = [entry, ...loadRecent().filter((existing) => existing.url !== entry.url)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private windows can refuse storage; recents are a convenience only.
  }
}
