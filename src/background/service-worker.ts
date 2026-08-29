/**
 * Service worker. The new tab does its own work in the page, so this exists
 * only for things that must survive the page being closed:
 *  - rotating the wallpaper slideshow on a schedule
 *  - one-time setup on install
 */

import { CHATGPT } from '@/features/widgets/llm/chatgpt'
import { CLAUDE } from '@/features/widgets/llm/claude'

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

/* ─────────────────────────────────────────────────── LLM usage reader ──── */

/**
 * Reads one LLM provider's usage on demand.
 *
 * The numbers live behind a session-authed endpoint on the provider's own web
 * app, so we run the fetch *inside* a tab on that origin: `chrome.scripting`
 * injects the provider's `fetchInPage` function, and the browser attaches the
 * user's session itself. We never touch the cookie or any token — only the
 * resulting figures come back.
 *
 * If a matching tab is already open we borrow it; otherwise we open one in the
 * background and close it when done, so the user's foreground is undisturbed.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'usage:refresh') return
  void readProviderUsage(String(message.provider)).then(sendResponse, (error: unknown) =>
    sendResponse({ ok: false, reason: describeError(error) }),
  )
  return true // keep the message channel open for the async response
})

async function readProviderUsage(
  providerId: string,
): Promise<{ ok: true; usage: unknown } | { ok: false; reason: string }> {
  // One adapter per provider; each usage widget names its own.
  const provider = [CLAUDE, CHATGPT].find((p) => p.id === providerId)
  if (!provider) return { ok: false, reason: `Unknown provider "${providerId}".` }

  const hostAllowed = await chrome.permissions.contains({
    permissions: ['tabs', 'scripting'],
    origins: provider.origins,
  })
  if (!hostAllowed) return { ok: false, reason: `Access to ${provider.host} has not been granted.` }

  // Match a tab already on the primary origin, else open one in the background.
  const existing = (await chrome.tabs.query({ url: provider.origins[0] }))[0]
  const tab = existing ?? (await chrome.tabs.create({ url: provider.tabUrl, active: false }))
  const opened = !existing

  try {
    if (opened) await waitForComplete(tab.id!)
    const [{ result } = { result: undefined }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      world: 'MAIN',
      func: provider.fetchInPage,
    })
    const parsed = result as { usage: unknown } | { error: string } | undefined
    if (!parsed || 'error' in parsed) {
      return { ok: false, reason: (parsed as { error?: string })?.error ?? 'No usage data.' }
    }
    return { ok: true, usage: parsed.usage }
  } finally {
    // Only close what we opened.
    if (opened && tab.id != null) await chrome.tabs.remove(tab.id).catch(() => {})
  }
}

function waitForComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timer)
      resolve()
    }
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === 'complete') done()
    }
    chrome.tabs.onUpdated.addListener(listener)
    // Don't hang forever if the load event never fires.
    const timer = setTimeout(done, 15000)
  })
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not read usage.'
}
