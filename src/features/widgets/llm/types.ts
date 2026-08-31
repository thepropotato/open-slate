// The vocabulary every LLM usage adapter normalises to, so the meters and the
// cache never need to know which provider produced a reading.

import type { IconName } from '@/core/icons'
import type { BrandName } from './BrandMark'

export interface ProviderWindow {
  label: string
  /** 0–100+, percent of this limit consumed. */
  percent: number
  /** ISO timestamp when it resets, if the provider gives one. */
  resetsAt: string | null
}

/** A dollar or credit balance, in major units. */
export interface ProviderSpend {
  used: number
  limit: number
  currency: string
  resetsAt: string | null
}

export interface ProviderUsage {
  windows: ProviderWindow[]
  spend: ProviderSpend | null
}

export type PageResult = { usage: ProviderUsage } | { error: string }

export interface ProviderAdapter {
  id: string
  label: string
  icon: IconName
  badge: BrandName
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
