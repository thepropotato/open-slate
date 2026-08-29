/**
 * Claude's usage adapter.
 *
 * The numbers live behind a session-authed endpoint on claude.ai, so we never
 * touch a cookie or token: the service worker injects `fetchInPage` into a tab
 * on that origin, where a same-origin `fetch` carries the user's session
 * automatically, and only the normalised figures come back.
 *
 * ── On schema drift ──────────────────────────────────────────────────────
 * The endpoint is private, so its shape can change without notice and a naive
 * key-path read would fail silently. `fetchInPage` therefore does two things:
 * it tries the *known* key-paths first, and if those come up empty it falls
 * back to a tolerant deep-search for values of the right *shape* (a 0-100
 * percentage, or a used/limit pair) anywhere in the response. The worker then
 * validates the result with a zod schema (see `api.ts`); if nothing sane is
 * found the widget shows a soft "shape changed" note rather than a wrong
 * number or a blank.
 *
 * Each provider gets its own adapter and its own widget, so adding one means a
 * new file beside this and a line in `features/widgets/index.ts` - nothing here
 * has to change.
 *
 * `chrome.scripting` serialises `fetchInPage` to inject it, so it may not close
 * over anything in this module: it is fully self-contained, including its own
 * copy of the small search helpers.
 */

import type { PageResult, ProviderAdapter, ProviderSpend, ProviderWindow } from './types'

/* ─────────────────────────────────────────────────────────── Claude ────── */

async function fetchClaude(): Promise<PageResult> {
  // Shape drift is expected on a private endpoint; look by shape, not just key.
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
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

  try {
    const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json')

    const orgRes = await fetch('/api/organizations', { credentials: 'include' })
    if (orgRes.status === 401 || orgRes.status === 403) return { error: 'Not signed in.' }
    if (!orgRes.ok) return { error: `Responded ${orgRes.status}.` }
    // A 200 that isn't JSON is the login/app-shell page — treat as signed out.
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

    // Dollar spend (Enterprise / credit-metered), with a tolerant fallback.
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

    // If neither model was found by key-path, deep-search for a percentage.
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

/** The Claude adapter. */
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
