import type { IconName } from '@/core/icons'
import { isExtension } from '@/core/platform/browser'
import type { Settings } from '@/core/settings/schema'
import { flushSettings, loadSettings, saveSettings } from '@/core/settings/store'
import { WALLPAPER_PRESETS, presetRef } from '@/core/wallpapers'

/** One entry per quick action. Add a row here and the popup grid picks it up. */
export interface PopupAction {
  id: string
  label: string
  /** A function lets the icon show state, such as the current theme. */
  icon: IconName | ((settings: Settings) => IconName)
  /** Current state, shown in the tooltip, such as the active theme. */
  hint?: (settings: Settings) => string
  /** Stay open after running, for actions that just change a setting. */
  keepOpen?: boolean
  run: (settings: Settings) => Promise<void>
}

// Extension URLs with a hash let the new tab open straight into settings, arrange mode and so on.
const openApp = async (hash = '') => {
  if (!isExtension()) return
  await chrome.tabs.create({ url: chrome.runtime.getURL(`newtab.html${hash}`) })
}

const patchSettings = async (change: (current: Settings) => Settings) => {
  saveSettings(change(await loadSettings()))
  await flushSettings()
}

const NEXT_MODE = { auto: 'light', light: 'dark', dark: 'auto' } as const

export const popupActions: PopupAction[] = [
  {
    id: 'new-tab',
    label: 'New tab',
    icon: 'open',
    run: async () => {
      if (isExtension()) await chrome.tabs.create({})
    },
  },
  { id: 'search', label: 'Search', icon: 'search', run: () => openApp('#palette') },
  { id: 'arrange', label: 'Arrange', icon: 'drag', run: () => openApp('#arrange') },
  { id: 'customise', label: 'Customise', icon: 'sliders', run: () => openApp('#settings') },
  {
    id: 'theme',
    label: 'Theme',
    icon: (s) => s.appearance.mode,
    keepOpen: true,
    hint: (s) => ({ auto: 'Follows the browser', light: 'Light', dark: 'Dark' })[s.appearance.mode],
    run: (s) =>
      patchSettings((current) => ({
        ...current,
        appearance: { ...current.appearance, mode: NEXT_MODE[s.appearance.mode] },
      })),
  },
  {
    id: 'wallpaper',
    label: 'Wallpaper',
    icon: 'image',
    keepOpen: true,
    hint: () => 'Next built-in wallpaper',
    run: (s) => {
      const index = WALLPAPER_PRESETS.findIndex((p) => presetRef(p.id) === s.background.image.url)
      const next = WALLPAPER_PRESETS[(index + 1) % WALLPAPER_PRESETS.length]
      return patchSettings((current) => ({
        ...current,
        background: {
          ...current.background,
          type: 'image',
          image: { url: presetRef(next.id), blobId: '' },
        },
      }))
    },
  },
]
