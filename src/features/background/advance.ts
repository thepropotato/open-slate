import { localStore } from '@/core/platform/browser'
import type { Settings } from '@/core/settings/schema'
import { CURSOR_KEY, nextSlide } from './slideshow'

export function slideCount(settings: Settings): number {
  return settings.background.slideshow.blobIds.length + settings.background.slideshow.urls.length
}

/**
 * Moves the slideshow on now, whatever the cadence says. Writes the shared
 * cursor, so every open tab follows: the point is to change the wallpaper, not
 * this tab's view of it.
 */
export async function advanceNow(settings: Settings): Promise<void> {
  const count = slideCount(settings)
  if (count < 2) return
  const stored = await localStore.get<number>(CURSOR_KEY)
  const current = typeof stored === 'number' ? stored : 0
  await localStore.set(CURSOR_KEY, nextSlide(current, count, settings.background.slideshow.shuffle))
}
