// Claude's usage adapter. The service worker injects `fetchInPage` into a tab on
// claude.ai, where a same-origin fetch carries the session; no cookie or token is
// read here and only normalised figures come back.
//
// The endpoint is private, so known key-paths are tried first and a shape-based
// deep search is the fallback; `api.ts` validates whatever comes back.
//
// `chrome.scripting` serialises `fetchInPage`, so it must not close over anything
// in this module - hence its own copy of the helpers.

import type { PageResult, ProviderAdapter, ProviderSpend, ProviderWindow } from './types'

async function fetchClaude(): Promise<PageResult> {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
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

  try {
    const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json')

    const orgRes = await fetch('/api/organizations', { credentials: 'include' })
    if (orgRes.status === 401 || orgRes.status === 403) return { error: 'Not signed in.' }
    if (!orgRes.ok) return { error: `Responded ${orgRes.status}.` }
    // A 200 that isn't JSON is the login page.
    if (!isJson(orgRes)) return { error: 'Not signed in.' }
    const orgs = (await orgRes.json()) as Array<{ uuid?: string; id?: string }>
    const orgId = orgs?.[0]?.uuid ?? orgs?.[0]?.id
    if (!orgId) return { error: 'No account found.' }

    const usageRes = await fetch(`/api/organizations/${orgId}/usage`, {
      credentials: 'include',
    })
    if (!usageRes.ok) return { error: `Usage responded ${usageRes.status}.` }
    if (!isJson(usageRes)) return { error: 'Not signed in.' }
    const data = (await usageRes.json()) as Record<string, unknown>

    const pickWindow = (key: string, label: string): ProviderWindow | null => {
      const w = asObj(data[key])
      const pct = w ? num(w.utilization) : null
      if (pct === null) return null
      return { label, percent: pct, resetsAt: w ? str(w.resets_at) : null }
    }

    let spend: ProviderSpend | null = null
    const s = asObj(data.spend)
    if (s) {
      const used = asObj(s.used)
      const limit = asObj(s.limit)
      const usedMinor = used ? num(used.amount_minor) : null
      const limitMinor = limit ? num(limit.amount_minor) : null
      if (usedMinor !== null && limitMinor !== null) {
        const exp = (used && num(used.exponent)) ?? 2
        const scale = 10 ** exp
        spend = {
          used: usedMinor / scale,
          limit: limitMinor / scale,
          currency: (used && str(used.currency)) ?? 'USD',
          resetsAt: str(s.resets_at) ?? str(s.reset_at),
        }
      }
    }

    const windows = [pickWindow('five_hour', '5-hour'), pickWindow('seven_day', 'Weekly')].filter(
      (w): w is ProviderWindow => w !== null,
    )

    if (!spend && windows.length === 0) {
      const pct = find(data, ['utilization', 'percent', 'percent_used'], (v) => {
        const n = num(v)
        return n !== null && n >= 0 && n <= 100
      })
      const n = num(pct)
      if (n !== null) windows.push({ label: 'Usage', percent: n, resetsAt: null })
    }

    if (!spend && windows.length === 0) return { error: 'No usage in response.' }
    return { usage: { windows, spend } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to read usage.' }
  }
}

export const CLAUDE: ProviderAdapter = {
  id: 'claude',
  label: 'Claude',
  icon: 'stocks',
  badge: 'anthropic',
  tint: '#d97757',
  origins: ['https://claude.ai/*'],
  host: 'claude.ai',
  tabUrl: 'https://claude.ai/',
  fetchInPage: fetchClaude,
}
