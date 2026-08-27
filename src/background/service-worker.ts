/**
 * Service worker. The new tab does its own work in the page, so this exists
 * only for things that must survive the page being closed:
 *  - rotating the wallpaper slideshow on a schedule
 *  - one-time setup on install
 */

const SLIDESHOW_ALARM = 'wallpaper-slideshow'

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ installedAt: Date.now() })
  }
  await syncSlideshowAlarm()
})

chrome.runtime.onStartup.addListener(() => void syncSlideshowAlarm())

// The page writes settings; the worker only reacts to them.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'settings' in changes) void syncSlideshowAlarm()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SLIDESHOW_ALARM) void advanceSlideshow()
})

interface SlideshowSettings {
  background?: {
    type?: string
    slideshow?: { intervalMinutes?: number; shuffle?: boolean; blobIds?: string[]; urls?: string[] }
  }
}

async function readSettings(): Promise<SlideshowSettings> {
  const { settings } = await chrome.storage.local.get('settings')
  return (settings ?? {}) as SlideshowSettings
}

async function syncSlideshowAlarm(): Promise<void> {
  const settings = await readSettings()
  const active = settings.background?.type === 'slideshow'
  if (!active) {
    await chrome.alarms.clear(SLIDESHOW_ALARM)
    return
  }
  const minutes = Math.max(1, settings.background?.slideshow?.intervalMinutes ?? 30)
  const existing = await chrome.alarms.get(SLIDESHOW_ALARM)
  if (existing && existing.periodInMinutes === minutes) return
  await chrome.alarms.create(SLIDESHOW_ALARM, { periodInMinutes: minutes, delayInMinutes: minutes })
}

/**
 * Stores the next slideshow index. The page reads `slideshowCursor` rather than
 * deciding for itself, so every open tab shows the same wallpaper.
 */
async function advanceSlideshow(): Promise<void> {
  const settings = await readSettings()
  const slideshow = settings.background?.slideshow
  const count = (slideshow?.blobIds?.length ?? 0) + (slideshow?.urls?.length ?? 0)
  if (count <= 1) return

  const { slideshowCursor = 0 } = await chrome.storage.local.get('slideshowCursor')
  const current = typeof slideshowCursor === 'number' ? slideshowCursor : 0
  const next = slideshow?.shuffle
    ? pickDifferent(current, count)
    : (current + 1) % count
  await chrome.storage.local.set({ slideshowCursor: next })
}

function pickDifferent(current: number, count: number): number {
  if (count < 2) return 0
  const offset = 1 + Math.floor(Math.random() * (count - 1))
  return (current + offset) % count
}
