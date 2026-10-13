import { isExtension } from '@/core/platform/browser'

/**
 * Built-in wallpapers, stored in settings as `preset:<id>` so the setting survives a changed
 * extension ID. `preset:auto` is Dawn in dark mode and Mist in light mode.
 */
export const WALLPAPER_PRESETS = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'night', label: 'Night' },
  { id: 'mist', label: 'Mist' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'tide', label: 'Tide' },
  { id: 'skyline', label: 'Skyline' },
  { id: 'dunes', label: 'Dunes' },
  { id: 'pines', label: 'Pines' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'contours', label: 'Contours' },
] as const

const PREFIX = 'preset:'
export const AUTO_PRESET = 'auto'

export const presetRef = (id: string): string => `${PREFIX}${id}`

export const presetIdOf = (url: string): string | null => {
  if (!url.startsWith(PREFIX)) return null
  const id = url.slice(PREFIX.length)
  return id === AUTO_PRESET || WALLPAPER_PRESETS.some((preset) => preset.id === id) ? id : null
}

const file = (name: string): string =>
  isExtension() ? chrome.runtime.getURL(`wallpapers/${name}`) : `/wallpapers/${name}`

export const presetThumb = (id: string): string => file(`${id}-thumb.jpg`)

/** Turns a `preset:` reference into a loadable address; anything else passes through. */
export function resolveWallpaperUrl(url: string, mode: 'light' | 'dark' = 'dark'): string {
  const id = presetIdOf(url)
  if (!id) return url
  const actual = id === AUTO_PRESET ? (mode === 'light' ? 'mist' : 'dawn') : id
  return file(`${actual}.jpg`)
}
