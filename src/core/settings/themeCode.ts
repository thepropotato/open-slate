import { Settings, type Settings as SettingsType } from './schema'

/**
 * Shareable theme codes.
 *
 * A code carries only the look — palette, shape, surfaces, wallpaper treatment
 * and layout — and deliberately never the content: no tiles, no notes, no place
 * names, and no references to locally stored media, which would not exist on
 * the receiving machine anyway.
 */

const PREFIX = 'nt1.'

interface ThemePayload {
  a: SettingsType['appearance']
  b: Omit<SettingsType['background'], 'image' | 'video' | 'slideshow'>
  l: SettingsType['layout']
  /** Tile appearance only — never the tiles themselves. */
  t: Omit<SettingsType['tiles'], 'items'>
}

export function encodeTheme(settings: SettingsType): string {
  const { image: _image, video: _video, slideshow: _slideshow, ...background } = settings.background
  const { items: _items, ...tiles } = settings.tiles
  const payload: ThemePayload = {
    a: settings.appearance,
    b: background,
    l: settings.layout,
    t: tiles,
  }
  return PREFIX + toBase64Url(JSON.stringify(payload))
}

/** Applies a code on top of existing settings, leaving all content untouched. */
export function applyTheme(settings: SettingsType, code: string): SettingsType {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('That is not a theme code.')

  let payload: ThemePayload
  try {
    payload = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length))) as ThemePayload
  } catch {
    throw new Error('That theme code is damaged.')
  }

  const merged = {
    ...settings,
    appearance: { ...settings.appearance, ...payload.a },
    // Media references stay local, so only the treatment is taken.
    background: { ...settings.background, ...payload.b },
    layout: { ...settings.layout, ...payload.l },
    tiles: { ...settings.tiles, ...payload.t, items: settings.tiles.items },
  }

  const parsed = Settings.safeParse(merged)
  if (!parsed.success) throw new Error('That theme code contains values this version cannot use.')
  return parsed.data
}

/** Base64url, so a code survives being pasted into a URL or a chat message. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const padded = code.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
