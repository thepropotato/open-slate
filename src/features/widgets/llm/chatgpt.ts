/**
 * ChatGPT's usage adapter.
 *
 * Same shape as Claude's, with one extra step: `chatgpt.com/backend-api/*`
 * rejects cookies alone with a 401, because the app authenticates with a bearer
 * token it mints client-side. The page exposes that token at `/api/auth/session`
 * (the Next-Auth convention), so `fetchInPage` reads the session first and
 * passes the token straight into the usage call.
 *
 * The token never leaves the page: it is minted inside the tab, used in the very
 * next request from that same tab, and only the normalised numbers cross back to
 * the worker. Nothing here reads a cookie.
 *
 * `chrome.scripting` serialises `fetchInPage` to inject it, so it may not close
 * over anything in this module: it is fully self-contained, including its own
 * copy of the small search helpers.
 */

import type { PageResult, ProviderAdapter, ProviderWindow } from './types'

/* ────────────────────────────────────────────────────────── ChatGPT ────── */

async function fetchChatGPT(): Promise<PageResult> {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const asObj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null

  // Depth-first search for the first value at any of `keys` matching `ok`.
  const find = (root: unknown, keys: string[], ok: (v: unknown) => boolean): unknown => {
    const seen = new Set<unknown>()
    const stack: unknown[] = [root]
    while (stack.length) {
      const cur = stack.pop()
      const o = asObj(cur)
      if (!o || seen.has(o)) continue
      seen.add(o)
      for (const k of keys) if (k in o && ok(o[k])) return o[k]
      for (const val of Object.values(o)) {
        if (val && typeof val === 'object') stack.push(val)
      }
    }
    return undefined
  }

  /** Epoch seconds → ISO, ignoring values that aren't plausibly a timestamp. */
  const isoFrom = (v: unknown): string | null => {
    const n = num(v)
    // Below ~2001 in epoch seconds this is a duration, not an instant.
    if (n === null || n < 1e9) return null
    return new Date(n * 1000).toISOString()
  }

  try {
    const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json')

    // 1. Mint the bearer token. A signed-out session returns `{}` with a 200.
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
    if (!sessionRes.ok) return { error: `Responded ${sessionRes.status}.` }
    if (!isJson(sessionRes)) return { error: 'Not signed in.' }
    const session = (await sessionRes.json()) as Record<string, unknown>
    const token = typeof session.accessToken === 'string' ? session.accessToken : null
    if (!token) return { error: 'Not signed in.' }

    // 2. Read usage with it.
    const usageRes = await fetch('/backend-api/wham/usage', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (usageRes.status === 401 || usageRes.status === 403) return { error: 'Not signed in.' }
    if (!usageRes.ok) return { error: `Usage responded ${usageRes.status}.` }
    if (!isJson(usageRes)) return { error: 'Not signed in.' }
    const data = (await usageRes.json()) as Record<string, unknown>

    const rate = asObj(data.rate_limit)

    /**
     * A window's label comes from how long it runs, because the API names the
     * two slots by precedence (`primary`/`secondary`) rather than by duration,
     * and which one is which varies by plan. "Weekly" is what a person reads.
     */
    const labelFor = (seconds: number | null, fallback: string): string => {
      if (seconds === null || seconds <= 0) return fallback
      const hours = Math.round(seconds / 3600)
      if (hours <= 1) return 'Hourly'
      if (hours < 24) return `${hours}-hour`
      const days = Math.round(hours / 24)
      if (days === 1) return 'Daily'
      if (days === 7) return 'Weekly'
      if (days >= 28 && days <= 31) return 'Monthly'
      return `${days}-day`
    }

    const pickWindow = (key: string, fallback: string): ProviderWindow | null => {
      const w = rate ? asObj(rate[key]) : null
      if (!w) return null
      const pct = num(w.used_percent)
      if (pct === null) return null
      return {
        label: labelFor(num(w.limit_window_seconds), fallback),
        percent: pct,
        resetsAt: isoFrom(w.reset_at),
      }
    }

    const windows = [
      pickWindow('primary_window', 'Usage'),
      pickWindow('secondary_window', 'Secondary'),
    ].filter((w): w is ProviderWindow => w !== null)

    // If the shape drifted, deep-search for a percentage rather than showing
    // nothing — the worker still validates whatever comes back.
    if (windows.length === 0) {
      const pct = find(data, ['used_percent', 'percent_used', 'utilization'], (v) => {
        const n = num(v)
        return n !== null && n >= 0 && n <= 100
      })
      const n = num(pct)
      if (n !== null) windows.push({ label: 'Usage', percent: n, resetsAt: null })
    }

    if (windows.length === 0) return { error: 'No usage in response.' }
    // ChatGPT meters by rate limit, not dollars; there is no spend to report.
    return { usage: { windows, spend: null } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to read usage.' }
  }
}

/** The ChatGPT adapter. */
export const CHATGPT: ProviderAdapter = {
  id: 'chatgpt',
  label: 'ChatGPT',
  icon: 'stocks',
  badge: 'openai',
  tint: '#000000',
  origins: ['https://chatgpt.com/*'],
  host: 'chatgpt.com',
  tabUrl: 'https://chatgpt.com/',
  fetchInPage: fetchChatGPT,
}
