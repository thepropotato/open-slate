/**
 * Search engines and their bang shortcuts.
 *
 * Each engine carries a home page so the UI can show its real favicon — the
 * same mechanism the tiles use — rather than inventing a glyph for it.
 */

export interface SearchEngine {
  id: string
  name: string
  /** `{q}` is replaced with the URL-encoded query. */
  template: string
  home: string
  /** Typed as `!g`, `!yt` and so on. First entry is the canonical one. */
  bangs: string[]
}

export const searchEngines: SearchEngine[] = [
  { id: 'google', name: 'Google', template: 'https://www.google.com/search?q={q}', home: 'https://www.google.com', bangs: ['g', 'google'] },
  { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={q}', home: 'https://duckduckgo.com', bangs: ['d', 'ddg'] },
  { id: 'bing', name: 'Bing', template: 'https://www.bing.com/search?q={q}', home: 'https://www.bing.com', bangs: ['b', 'bing'] },
  { id: 'brave', name: 'Brave', template: 'https://search.brave.com/search?q={q}', home: 'https://search.brave.com', bangs: ['br', 'brave'] },
  { id: 'ecosia', name: 'Ecosia', template: 'https://www.ecosia.org/search?q={q}', home: 'https://www.ecosia.org', bangs: ['ec'] },
  { id: 'startpage', name: 'Startpage', template: 'https://www.startpage.com/sp/search?query={q}', home: 'https://www.startpage.com', bangs: ['sp'] },
  { id: 'perplexity', name: 'Perplexity', template: 'https://www.perplexity.ai/search?q={q}', home: 'https://www.perplexity.ai', bangs: ['pp', 'px'] },
  { id: 'chatgpt', name: 'ChatGPT', template: 'https://chatgpt.com/?q={q}', home: 'https://chatgpt.com', bangs: ['gpt', 'ai'] },
  { id: 'claude', name: 'Claude', template: 'https://claude.ai/new?q={q}', home: 'https://claude.ai', bangs: ['c', 'claude'] },
  { id: 'wikipedia', name: 'Wikipedia', template: 'https://en.wikipedia.org/w/index.php?search={q}', home: 'https://en.wikipedia.org', bangs: ['w', 'wiki'] },
  { id: 'youtube', name: 'YouTube', template: 'https://www.youtube.com/results?search_query={q}', home: 'https://www.youtube.com', bangs: ['yt'] },
  { id: 'github', name: 'GitHub', template: 'https://github.com/search?q={q}', home: 'https://github.com', bangs: ['gh'] },
  { id: 'stackoverflow', name: 'Stack Overflow', template: 'https://stackoverflow.com/search?q={q}', home: 'https://stackoverflow.com', bangs: ['so'] },
  { id: 'npm', name: 'npm', template: 'https://www.npmjs.com/search?q={q}', home: 'https://www.npmjs.com', bangs: ['npm'] },
  { id: 'mdn', name: 'MDN', template: 'https://developer.mozilla.org/en-US/search?q={q}', home: 'https://developer.mozilla.org', bangs: ['mdn'] },
  { id: 'maps', name: 'Google Maps', template: 'https://www.google.com/maps/search/{q}', home: 'https://www.google.com/maps', bangs: ['map', 'maps'] },
  { id: 'images', name: 'Google Images', template: 'https://www.google.com/search?tbm=isch&q={q}', home: 'https://images.google.com', bangs: ['img', 'i'] },
  { id: 'translate', name: 'Translate', template: 'https://translate.google.com/?text={q}', home: 'https://translate.google.com', bangs: ['tr'] },
  { id: 'amazon', name: 'Amazon', template: 'https://www.amazon.com/s?k={q}', home: 'https://www.amazon.com', bangs: ['a', 'az'] },
  { id: 'reddit', name: 'Reddit', template: 'https://www.reddit.com/search/?q={q}', home: 'https://www.reddit.com', bangs: ['r'] },
  { id: 'imdb', name: 'IMDb', template: 'https://www.imdb.com/find/?q={q}', home: 'https://www.imdb.com', bangs: ['imdb'] },
  { id: 'spotify', name: 'Spotify', template: 'https://open.spotify.com/search/{q}', home: 'https://open.spotify.com', bangs: ['sp2', 'spot'] },
  { id: 'x', name: 'X', template: 'https://x.com/search?q={q}', home: 'https://x.com', bangs: ['x', 'tw'] },
]

export const getEngine = (id: string): SearchEngine =>
  searchEngines.find((engine) => engine.id === id) ?? searchEngines[0]

const bangIndex = new Map<string, SearchEngine>()
for (const engine of searchEngines) {
  for (const bang of engine.bangs) bangIndex.set(bang, engine)
}

export interface ParsedQuery {
  engine: SearchEngine
  /** The query with any bang removed. */
  query: string
  /** The bang that was recognised, for showing feedback in the UI. */
  bang?: string
}

/**
 * Splits a bang prefix off the query. Both `!yt cats` and the trailing form
 * `cats !yt` are accepted, because muscle memory differs between the two.
 */
export function parseQuery(raw: string, fallbackId: string, bangsEnabled: boolean): ParsedQuery {
  const fallback = getEngine(fallbackId)
  const input = raw.trim()
  if (!bangsEnabled || !input.includes('!')) return { engine: fallback, query: input }

  const leading = /^!([a-z0-9]+)\s+(.*)$/is.exec(input)
  if (leading) {
    const engine = bangIndex.get(leading[1].toLowerCase())
    if (engine) return { engine, query: leading[2].trim(), bang: leading[1].toLowerCase() }
  }

  const trailing = /^(.*?)\s+!([a-z0-9]+)$/is.exec(input)
  if (trailing) {
    const engine = bangIndex.get(trailing[2].toLowerCase())
    if (engine) return { engine, query: trailing[1].trim(), bang: trailing[2].toLowerCase() }
  }

  // A bare `!yt` with no query goes to that engine's home page.
  const bare = /^!([a-z0-9]+)$/i.exec(input)
  if (bare) {
    const engine = bangIndex.get(bare[1].toLowerCase())
    if (engine) return { engine, query: '', bang: bare[1].toLowerCase() }
  }

  return { engine: fallback, query: input }
}

export const buildSearchUrl = ({ engine, query }: ParsedQuery): string =>
  query ? engine.template.replace('{q}', encodeURIComponent(query)) : engine.home

/**
 * Recognises input that is already a destination — a URL, a bare host, or a
 * localhost address — so typing "github.com/anthropics" navigates rather than
 * searching for it.
 */
export function asDestination(input: string): string | null {
  const value = input.trim()
  if (!value || /\s/.test(value)) return null
  if (/^(https?|ftp|file|chrome|about|edge):/i.test(value)) return value
  if (/^localhost(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`
  // A dotted label with a plausible TLD, e.g. example.com or sub.example.co.uk
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(value) && /\.[a-z]{2,}(?:[:/]|$)/i.test(value)) {
    return `https://${value}`
  }
  return null
}
