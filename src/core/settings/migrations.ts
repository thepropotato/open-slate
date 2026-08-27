import { SETTINGS_VERSION, Settings, type Settings as SettingsType } from './schema'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Ordered upgrade steps, indexed by the version they upgrade *from*.
 * Adding a field never needs a migration — zod defaults cover that. Only
 * renames, moves and semantic changes belong here.
 */
const migrations: Record<number, Migration> = {
  // 0: (raw) => ({ ...raw, appearance: { ...raw.appearance, ... } }),
}

/** Brings any previously-stored blob up to the current shape. Never throws. */
export function migrate(raw: unknown): SettingsType {
  if (raw === null || typeof raw !== 'object') return Settings.parse({})

  let data = raw as Record<string, unknown>
  let version = typeof data.version === 'number' ? data.version : 0

  while (version < SETTINGS_VERSION) {
    const step = migrations[version]
    if (step) data = step(data)
    version += 1
  }
  data = { ...data, version: SETTINGS_VERSION }

  const parsed = Settings.safeParse(data)
  if (parsed.success) return parsed.data

  // A corrupted or partially-invalid blob should degrade to defaults for the
  // broken sections rather than wiping everything the user configured.
  console.warn('[settings] falling back to defaults for invalid fields', parsed.error.issues)
  return Settings.parse(salvage(data))
}

/** Drops only the top-level sections that fail validation. */
function salvage(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { version: SETTINGS_VERSION }
  const shape = Settings.shape as Record<string, { safeParse(v: unknown): { success: boolean } }>
  for (const key of Object.keys(shape)) {
    if (key === 'version' || !(key in data)) continue
    if (shape[key].safeParse(data[key]).success) out[key] = data[key]
  }
  return out
}
