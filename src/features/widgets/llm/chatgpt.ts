// ChatGPT's usage adapter. Like Claude's, plus one step: `/backend-api/*` 401s on
// cookies alone, so the token is read from `/api/auth/session` first. The token
// never leaves the page; only the normalised numbers cross back to the worker.
//
// `chrome.scripting` serialises `fetchInPage`, so it must not close over anything
// in this module — hence its own copy of the helpers.

import type { PageResult, ProviderAdapter, ProviderWindow } from './types'

async function fetchChatGPT(): Promise<PageResult> {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const asObj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null

  // First value at any of `keys` matching `ok`, at any depth.
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

  // Epoch seconds to ISO.
  const isoFrom = (v: unknown): string | null => {
    const n = num(v)
    // Below ~2001 in epoch seconds it is a duration, not an instant.
    if (n === null || n < 1e9) return null
    return new Date(n * 1000).toISOString()
  }

  try {
    const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json')

    // Mint the bearer token. A signed-out session returns `{}` with a 200.
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
    if (!sessionRes.ok) return { error: `Responded ${sessionRes.status}.` }
    if (!isJson(sessionRes)) return { error: 'Not signed in.' }
    const session = (await sessionRes.json()) as Record<string, unknown>
    const token = typeof session.accessToken === 'string' ? session.accessToken : null
    if (!token) return { error: 'Not signed in.' }

    const usageRes = await fetch('/backend-api/wham/usage', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (usageRes.status === 401 || usageRes.status === 403) return { error: 'Not signed in.' }
    if (!usageRes.ok) return { error: `Usage responded ${usageRes.status}.` }
    if (!isJson(usageRes)) return { error: 'Not signed in.' }
    const data = (await usageRes.json()) as Record<string, unknown>

    const rate = asObj(data.rate_limit)

    // Labelled by duration: the API names its slots `primary`/`secondary` by
    // precedence, and which is which varies by plan.
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

    // Fallback for shape drift; the worker still validates the result.
    if (windows.length === 0) {
      const pct = find(data, ['used_percent', 'percent_used', 'utilization'], (v) => {
        const n = num(v)
        return n !== null && n >= 0 && n <= 100
      })
      const n = num(pct)
      if (n !== null) windows.push({ label: 'Usage', percent: n, resetsAt: null })
    }

    if (windows.length === 0) return { error: 'No usage in response.' }
    // ChatGPT meters by rate limit, not dollars.
    return { usage: { windows, spend: null } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to read usage.' }
  }
}

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
