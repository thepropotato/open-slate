import { localStore } from '@/core/platform/browser'
import { SETTINGS_KEY, Settings, type Settings as SettingsType } from './schema'
import { migrate } from './migrations'

/** Persistence for the settings blob. Writes are debounced; the last write wins. */

const WRITE_DEBOUNCE_MS = 180

let pending: SettingsType | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export async function loadSettings(): Promise<SettingsType> {
  const raw = await localStore.get(SETTINGS_KEY)
  return migrate(raw)
}

export function saveSettings(settings: SettingsType): void {
  pending = settings
  if (timer) clearTimeout(timer)
  timer = setTimeout(flushSettings, WRITE_DEBOUNCE_MS)
}

export async function flushSettings(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!pending) return
  const payload = pending
  pending = null
  await localStore.set(SETTINGS_KEY, payload)
}

/** Notifies on changes written by any other open new tab or the options page. */
export function subscribeSettings(fn: (s: SettingsType) => void): () => void {
  return localStore.subscribe(SETTINGS_KEY, (value) => fn(migrate(value)))
}

export async function resetSettings(): Promise<SettingsType> {
  const fresh = Settings.parse({})
  pending = null
  await localStore.set(SETTINGS_KEY, fresh)
  return fresh
}

export function exportSettings(settings: SettingsType): string {
  return JSON.stringify(settings, null, 2)
}

export function importSettings(json: string): SettingsType {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That is not valid JSON.')
  }
  return migrate(parsed)
}
