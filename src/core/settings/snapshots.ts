import { localStore } from '@/core/platform/browser'
import { migrate } from './migrations'
import type { Settings } from './schema'

/** The last few saved states, kept so a bad experiment can be undone. Local to this browser. */
const KEY = 'settingsSnapshots'
const MAX = 5

export interface Snapshot {
  at: number
  settings: Settings
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const raw = await localStore.get<Snapshot[]>(KEY)
  return Array.isArray(raw) ? raw.filter((item) => item?.settings && typeof item.at === 'number') : []
}

/** Remembers `settings` as they are now. Skipped when identical to the newest snapshot. */
export async function pushSnapshot(settings: Settings): Promise<void> {
  const list = await listSnapshots()
  if (list[0] && JSON.stringify(list[0].settings) === JSON.stringify(settings)) return
  await localStore.set(KEY, [{ at: Date.now(), settings }, ...list].slice(0, MAX))
}

export const snapshotSettings = (snapshot: Snapshot): Settings => migrate(snapshot.settings)
