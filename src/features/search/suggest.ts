import type { IconName } from '@/core/icons'
import { isExtension, openUrl, permissions, searchDefault } from '@/core/platform/browser'
import type { Suggestion } from './providers'

/** Only reached outside the extension, where `chrome.search` does not exist. */
const FALLBACK = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`

/**
 * Web suggestions from a public autocomplete endpoint. Chrome exposes no way to
 * read the browser's default engine, let alone its completions, so these come
 * from a fixed source; picking one still submits through the browser default.
 * Unlike the local providers this does send the typed query off the machine,
 * so it is gated on `search.webSuggestions` and skipped entirely for input the
 * calculator or the address matcher already claimed.
 */

// The endpoint answers with the OpenSearch array form:
// ["typed", ["first", "second", ...], ...].
const SUGGEST_ENDPOINT = (q: string) =>
  `https://suggestqueries.google.com/complete/search?client=firefox&q=${q}`

const SUGGEST_ORIGIN = `${new URL(SUGGEST_ENDPOINT('')).origin}/*`

/** Whether completions can actually be fetched. */
export const hasSuggestAccess = (): Promise<boolean> => permissions.has([], [SUGGEST_ORIGIN])

/** Must be called from a click: Chrome only prompts on a user gesture. */
export const requestSuggestAccess = (): Promise<boolean> => permissions.request([], [SUGGEST_ORIGIN])

export interface SuggestOptions {
  limit?: number
  openIn?: 'current' | 'newTab'
  signal?: AbortSignal
}

export async function remoteSuggest(
  query: string,
  options: SuggestOptions = {},
): Promise<Suggestion[]> {
  const needle = query.trim()
  if (!needle) return []

  const limit = options.limit ?? 5
  const url = SUGGEST_ENDPOINT(encodeURIComponent(needle))

  try {
    const terms = await fetchTerms(url, options.signal)
    return terms
      // The endpoint usually echoes the typed text back as the first entry.
      .filter((term) => term && term.toLowerCase() !== needle.toLowerCase())
      .slice(0, limit)
      .map((term, index) => ({
        id: `suggest:${term}`,
        kind: 'search' as const,
        title: term,
        icon: 'search' as IconName,
        // Below every local hit: your own tabs and tiles outrank a guess.
        score: -1 - index,
        run: () => {
          const where = options.openIn ?? 'current'
          if (!searchDefault(term, where)) openUrl(FALLBACK(term), where)
        },
      }))
  } catch {
    return []
  }
}

/**
 * The worker fetches, so the request carries the extension's host permission
 * rather than the newtab origin, whose CORS treatment differs.
 * Outside the extension (`vite dev`) it goes direct.
 */
async function fetchTerms(url: string, signal?: AbortSignal): Promise<string[]> {
  if (isExtension()) {
    // `permissions.request` needs a user gesture, which typing is not, so
    // ungranted access just yields nothing until it is granted from settings.
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
