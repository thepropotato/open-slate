import type { IconName } from '@/core/icons'
import { isExtension, openUrl, permissions } from '@/core/platform/browser'
import { buildSearchUrl, getEngine } from './engines'
import type { Suggestion } from './providers'

/**
 * Web suggestions from the chosen engine's public autocomplete endpoint.
 * Unlike the local providers this does send the typed query off the machine,
 * so it is gated on `search.webSuggestions` and skipped entirely for input the
 * calculator or the address matcher already claimed.
 */

// Every endpoint here answers with the OpenSearch array form:
// ["typed", ["first", "second", ...], ...]. Engines absent from this map
// simply contribute no web suggestions.
const SUGGEST_ENDPOINTS: Record<string, (q: string) => string> = {
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${q}`,
  duckduckgo: (q) => `https://duckduckgo.com/ac/?type=list&q=${q}`,
  bing: (q) => `https://www.bing.com/osjson.aspx?query=${q}`,
  brave: (q) => `https://search.brave.com/api/suggest?q=${q}`,
  ecosia: (q) => `https://ac.ecosia.org/autocomplete?type=list&q=${q}`,
  startpage: (q) => `https://www.startpage.com/suggestions?segment=startpage.udog&format=opensearch&q=${q}`,
  youtube: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${q}`,
  wikipedia: (q) => `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${q}`,
  amazon: (q) => `https://completion.amazon.com/search/complete?method=completion&mkt=1&search-alias=aps&q=${q}`,
}

export const hasWebSuggestions = (engineId: string): boolean => engineId in SUGGEST_ENDPOINTS

const originFor = (engineId: string): string | null => {
  const endpoint = SUGGEST_ENDPOINTS[engineId]
  return endpoint ? `${new URL(endpoint('')).origin}/*` : null
}

/** Whether this engine's completions can actually be fetched. */
export function hasSuggestAccess(engineId: string): Promise<boolean> {
  const origin = originFor(engineId)
  return origin ? permissions.has([], [origin]) : Promise.resolve(false)
}

/** Must be called from a click: Chrome only prompts on a user gesture. */
export function requestSuggestAccess(engineId: string): Promise<boolean> {
  const origin = originFor(engineId)
  return origin ? permissions.request([], [origin]) : Promise.resolve(false)
}

export interface SuggestOptions {
  limit?: number
  openIn?: 'current' | 'newTab'
  signal?: AbortSignal
}

export async function remoteSuggest(
  query: string,
  engineId: string,
  options: SuggestOptions = {},
): Promise<Suggestion[]> {
  const needle = query.trim()
  const endpoint = SUGGEST_ENDPOINTS[engineId]
  if (!needle || !endpoint) return []

  const limit = options.limit ?? 5
  const url = endpoint(encodeURIComponent(needle))

  try {
    const terms = await fetchTerms(url, options.signal)
    const engine = getEngine(engineId)
    return terms
      // The engine usually echoes the typed text back as the first entry.
      .filter((term) => term && term.toLowerCase() !== needle.toLowerCase())
      .slice(0, limit)
      .map((term, index) => ({
        id: `suggest:${engineId}:${term}`,
        kind: 'search' as const,
        title: term,
        icon: 'search' as IconName,
        // Below every local hit: your own tabs and tiles outrank a guess.
        score: -1 - index,
        run: () => openUrl(buildSearchUrl({ engine, query: term }), options.openIn ?? 'current'),
      }))
  } catch {
    return []
  }
}

/**
 * The worker fetches, so the request carries the extension's host permission
 * rather than the newtab origin, whose CORS treatment varies per engine.
 * Outside the extension (`vite dev`) it goes direct.
 */
async function fetchTerms(url: string, signal?: AbortSignal): Promise<string[]> {
  if (isExtension()) {
    // `permissions.request` needs a user gesture, which typing is not, so an
    // ungranted engine just yields nothing until it is granted from settings.
    const origin = `${new URL(url).origin}/*`
    if (!(await chrome.permissions.contains({ origins: [origin] }))) return []
    const reply = (await chrome.runtime.sendMessage({ type: 'suggest:query', url })) as
      | { ok: true; terms: string[] }
      | { ok: false }
      | undefined
    if (!reply?.ok) return []
    return reply.terms
  }
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok) return []
  return parseTerms(await response.json())
}

/** Second element of the OpenSearch array is the list of completions. */
export function parseTerms(payload: unknown): string[] {
  if (!Array.isArray(payload)) return []
  const terms = payload[1]
  if (!Array.isArray(terms)) return []
  return terms.filter((term): term is string => typeof term === 'string')
}
