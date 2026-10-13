import { localStore } from '@/core/platform/browser'
import { uid } from '@/core/util/id'
import { encodeSlate } from './slateCode'
import type { Settings } from './schema'

/**
 * Scenes: named, saved layouts you can switch between, optionally on a schedule.
 * A scene is a slate code, so it carries the widget grid and the shape of the page and
 * nothing personal. Kept in this browser, apart from the settings blob.
 */
const KEY = 'scenes'
const CURSOR_KEY = 'sceneCursor'

export interface SceneSchedule {
  /** 0 is Sunday, as in `Date#getDay`. */
  days: number[]
  /** 24-hour `HH:MM`. A range that ends before it starts runs overnight. */
  from: string
  to: string
}

export interface Scene {
  id: string
  name: string
  code: string
  schedule: SceneSchedule | null
}

export async function listScenes(): Promise<Scene[]> {
  const raw = await localStore.get<Scene[]>(KEY)
  return Array.isArray(raw) ? raw.filter((scene) => scene?.id && scene.code) : []
}

export async function saveScenes(scenes: Scene[]): Promise<void> {
  await localStore.set(KEY, scenes)
}

export const sceneFromSettings = (settings: Settings, name: string): Scene => ({
  id: uid('scene'),
  name: name.trim() || 'Scene',
  code: encodeSlate(settings, name),
  schedule: null,
})

const minutes = (clock: string): number => {
  const [hours = 0, mins = 0] = clock.split(':').map(Number)
  return hours * 60 + mins
}

/** The first scene whose schedule covers `at`, if any. */
export function sceneFor(scenes: Scene[], at: Date): Scene | null {
  const now = at.getHours() * 60 + at.getMinutes()
  const today = at.getDay()
  const yesterday = (today + 6) % 7

  return (
    scenes.find(({ schedule }) => {
      if (!schedule || schedule.days.length === 0) return false
      const from = minutes(schedule.from)
      const to = minutes(schedule.to)
      if (from <= to) return schedule.days.includes(today) && now >= from && now < to
      // Overnight: the evening belongs to the day it starts on, the small hours to the next.
      return (schedule.days.includes(today) && now >= from) || (schedule.days.includes(yesterday) && now < to)
    }) ?? null
  )
}

export const getSceneCursor = (): Promise<string | undefined> => localStore.get<string>(CURSOR_KEY)
export const setSceneCursor = (id: string | null): Promise<void> =>
  id ? localStore.set(CURSOR_KEY, id) : localStore.remove(CURSOR_KEY)
