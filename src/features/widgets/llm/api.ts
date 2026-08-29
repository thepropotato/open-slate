import { z } from 'zod'
import { isExtension, localStore } from '@/core/platform/browser'
import type { ProviderAdapter, ProviderUsage } from './types'

/**
 * Shared data layer for the per-provider LLM usage widgets.
 *
 * A provider is read on demand from its own signed-in web session: the widget
 * asks the service worker, which injects that provider's same-origin fetch into
 * a tab on its origin (see `service-worker.ts`). We never read a cookie or
 * token — only the resulting numbers come back, and they are validated here
 * before the UI trusts them.
 *
 * Everything here is keyed by a provider id, so a new provider needs an adapter
 * and a widget and nothing else.
 */

export type { ProviderUsage, ProviderWindow, ProviderSpend, ProviderAdapter } from './types'

/* ────────────────────────────────────────────────────── validation ─────── */

/**
 * The shape a `fetchInPage` must produce. Validated here so that a drifted
 * endpoint can't push a malformed reading into the UI: if a provider's
 * extraction returns something off-shape, we treat it as "shape changed"
 * rather than rendering a wrong or blank number.
 */
const WindowSchema = z.object({
  label: z.string(),
  percent: z.number().finite(),
  resetsAt: z.string().nullable(),
})

const SpendSchema = z.object({
  used: z.number().finite(),
  limit: z.number().finite(),
  currency: z.string(),
  resetsAt: z.string().nullable(),
})

export const UsageSchema = z.object({
  windows: z.array(WindowSchema),
  spend: SpendSchema.nullable(),
})

/** True if the reading actually carries something to show. */
export const hasNumbers = (u: ProviderUsage): boolean =>
  u.spend !== null || u.windows.length > 0

/* ─────────────────────────────────────────────────────────── cache ─────── */

export interface CachedUsage {
  at: number
  usage: ProviderUsage
}

const cacheKey = (providerId: string) => `usageCache:${providerId}`

export const readCache = (providerId: string): Promise<CachedUsage | undefined> =>
  localStore.get<CachedUsage>(cacheKey(providerId))

const writeCache = (providerId: string, entry: CachedUsage): Promise<void> =>
  localStore.set(cacheKey(providerId), entry)

/* ─────────────────────────────────────────────────── permissions ───────── */

/** `tabs` + `scripting` + the provider's host, requested in one gesture. */
const request = (provider: ProviderAdapter): chrome.permissions.Permissions => ({
  permissions: ['tabs', 'scripting'],
  origins: provider.origins,
})

export const hasAccess = (provider: ProviderAdapter): Promise<boolean> => {
  if (!isExtension()) return Promise.resolve(true)
  return chrome.permissions.contains(request(provider))
}

export const requestAccess = (provider: ProviderAdapter): Promise<boolean> => {
  if (!isExtension()) return Promise.resolve(true)
  return chrome.permissions.request(request(provider))
}

/* ────────────────────────────────────────────────────────── refresh ────── */

/** Dev stub so a widget renders under `vite dev` (no worker, no session). */
function devStub(providerId: string): ProviderUsage {
  if (providerId === 'claude') {
    return {
      windows: [],
      spend: {
        used: 403.66,
        limit: 500,
        currency: 'USD',
        resetsAt: new Date(Date.now() + 6e5 * 720).toISOString(),
      },
    }
  }
  if (providerId === 'chatgpt') {
    return {
      windows: [
        { label: 'Weekly', percent: 94, resetsAt: new Date(Date.now() + 2.6e8).toISOString() },
        { label: '5-hour', percent: 12, resetsAt: new Date(Date.now() + 9e6).toISOString() },
      ],
      spend: null,
    }
  }
  return {
    windows: [{ label: 'Usage', percent: 42, resetsAt: null }],
    spend: null,
  }
}

/**
 * Triggers a fresh read for one provider. Delegates to the service worker,
 * which owns the tab and scripting APIs, then validates the reply.
 */
export async function refreshUsage(providerId: string): Promise<CachedUsage> {
  if (!isExtension()) {
    const entry = { at: Date.now(), usage: devStub(providerId) }
    await writeCache(providerId, entry)
    return entry
  }

  const res = (await chrome.runtime.sendMessage({
    type: 'usage:refresh',
    provider: providerId,
  })) as { ok: true; usage: unknown } | { ok: false; reason: string } | undefined

  if (!res) throw new Error('The background worker did not respond.')
  if (!res.ok) throw new Error(res.reason)

  const parsed = UsageSchema.safeParse(res.usage)
  if (!parsed.success) {
    throw new Error("This provider's usage page returned an unexpected shape.")
  }

  const entry = { at: Date.now(), usage: parsed.data }
  await writeCache(providerId, entry)
  return entry
}
