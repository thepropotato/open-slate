/**
 * Shapes shared by every LLM usage provider.
 *
 * Each provider gets its own adapter file and its own widget; this is the
 * common vocabulary they normalise to, so the meters and the cache do not need
 * to know which provider produced a reading.
 */

import type { IconName } from '@/core/icons'
import type { BrandName } from './BrandMark'

/** One rolling window or limit, normalised across providers. */
export interface ProviderWindow {
  label: string
  /** 0–100+, percent of this limit consumed. */
  percent: number
  /** ISO timestamp when it resets, if the provider gives one. */
  resetsAt: string | null
}

/** A dollar (or credit) balance, normalised across providers. Major units. */
export interface ProviderSpend {
  used: number
  limit: number
  currency: string
  resetsAt: string | null
}

/** The normalised reading for one provider. */
export interface ProviderUsage {
  windows: ProviderWindow[]
  spend: ProviderSpend | null
}

/** What a `fetchInPage` returns before it crosses back to the worker. */
export type PageResult = { usage: ProviderUsage } | { error: string }

export interface ProviderAdapter {
  id: string
  label: string
  icon: IconName
  /** Which logo to draw in the header (see `BrandMark`). */
  badge: BrandName
  /** Brand accent the mark is drawn on. */
  tint: string
  /** Host pattern(s) for the permission request and tab lookup. */
  origins: string[]
  /** Human host shown in the connect prompt, e.g. "claude.ai". */
  host: string
  /** URL opened when we need a tab on this origin. */
  tabUrl: string
  /** Injected into a tab on `origins[0]`; runs in the page's MAIN world. */
  fetchInPage: () => Promise<PageResult>
}
