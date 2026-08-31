import type { Settings } from '@/core/settings/schema'
import { ensureContrast, readableOn } from './color'
import { resolveFontStack } from './fonts'
import { getPreset, type Palette } from './presets'

/**
 * Settings to CSS custom properties. Pure and separate from `ThemeProvider` so a
 * preview paints the same values onto a container and can never drift from the page.
 */

const densitySpace = { compact: 9, comfortable: 12, spacious: 16 } as const

const shadowValue = {
  none: 'none',
  soft: '0 12px 32px rgb(0 0 0 / 28%)',
  strong: '0 18px 48px rgb(0 0 0 / 46%)',
} as const

/** Resolves `auto` against a known light/dark preference. */
export function resolveMode(
  mode: Settings['appearance']['mode'],
  prefersDark: boolean,
): 'light' | 'dark' {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light'
  return mode
}

export function resolvePalette(appearance: Settings['appearance'], mode: 'light' | 'dark'): Palette {
  return getPreset(appearance.preset)[mode]
}

export function resolveAccent(
  appearance: Settings['appearance'],
  palette: Palette,
  sampledAccent: string | null,
): string {
  const raw =
    appearance.accentSource === 'custom'
      ? appearance.accent
      : appearance.accentSource === 'wallpaper'
        ? sampledAccent ?? palette.accent
        : palette.accent
  // A sampled colour can land anywhere, so force it to stay legible.
  return appearance.accentSource === 'wallpaper' ? ensureContrast(raw, palette.bg, 3.2) : raw
}

/** The custom properties for one settings object, as a plain name/value map. */
export function themeVars(
  appearance: Settings['appearance'],
  palette: Palette,
  accent: string,
): Record<string, string> {
  return {
    '--bg': palette.bg,
    '--bg-elevated': palette.bgElevated,
    '--fg': palette.fg,
    '--fg-muted': palette.fgMuted,
    '--fg-subtle': palette.fgSubtle,
    '--line': palette.line,
    '--surface-base': palette.surfaceBase,
    '--surface-tint': palette.surfaceTint,
    '--accent': accent,
    '--accent-fg': readableOn(accent),
    '--radius': `${appearance.radius}px`,
    '--surface-opacity': String(appearance.surfaceOpacity),
    '--surface-blur': `${appearance.surfaceBlur}px`,
    '--shadow': shadowValue[appearance.shadow],
    '--space': `${densitySpace[appearance.density]}px`,
    '--font': resolveFontStack(appearance.fontFamily),
    '--font-scale': String(appearance.fontScale),
    '--motion': appearance.animations ? '1' : '0',
  }
}

/** The `data-*` flags beside the variables; stylesheets select on these, so a scoped theme carries them too. */
export function themeFlags(
  appearance: Settings['appearance'],
  mode: 'light' | 'dark',
): Record<string, string> {
  return {
    mode,
    surface: appearance.surface,
    density: appearance.density,
    shadow: appearance.shadow,
    zen: String(appearance.zenMode),
  }
}
