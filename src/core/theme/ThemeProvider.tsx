import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import { accentStore } from './accentStore'
import { ensureContrast, readableOn } from './color'
import { resolveFontStack } from './fonts'
import { getPreset, type Palette } from './presets'

const densitySpace = { compact: 9, comfortable: 12, spacious: 16 } as const

const shadowValue = {
  none: 'none',
  soft: '0 12px 32px rgb(0 0 0 / 28%)',
  strong: '0 18px 48px rgb(0 0 0 / 46%)',
} as const

/** Resolves `auto` against the browser's light/dark preference. */
function usePrefersDark(): boolean {
  const query = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), [])
  return useSyncExternalStore(
    (fn) => {
      query.addEventListener('change', fn)
      return () => query.removeEventListener('change', fn)
    },
    () => query.matches,
    () => true,
  )
}

export function useResolvedMode(): 'light' | 'dark' {
  const { appearance } = useSettings()
  const prefersDark = usePrefersDark()
  if (appearance.mode === 'auto') return prefersDark ? 'dark' : 'light'
  return appearance.mode
}

/** The active palette, for the rare case a component needs real colour maths. */
export function usePalette(): Palette {
  const { appearance } = useSettings()
  return getPreset(appearance.preset)[useResolvedMode()]
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const { appearance } = settings
  const mode = useResolvedMode()
  const sampledAccent = useSyncExternalStore(accentStore.subscribe, accentStore.get, () => null)

  const palette: Palette = getPreset(appearance.preset)[mode]

  const accent = useMemo(() => {
    const raw =
      appearance.accentSource === 'custom'
        ? appearance.accent
        : appearance.accentSource === 'wallpaper'
          ? sampledAccent ?? palette.accent
          : palette.accent
    // A sampled colour can land anywhere, so force it to stay legible.
    return appearance.accentSource === 'wallpaper' ? ensureContrast(raw, palette.bg, 3.2) : raw
  }, [appearance.accentSource, appearance.accent, sampledAccent, palette])

  useEffect(() => {
    const root = document.documentElement
    const vars: Record<string, string> = {
      '--bg': palette.bg,
      '--bg-elevated': palette.bgElevated,
      '--fg': palette.fg,
      '--fg-muted': palette.fgMuted,
      '--fg-subtle': palette.fgSubtle,
      '--line': palette.line,
      '--surface-base': palette.surfaceBase,
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
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)

    root.style.colorScheme = mode
    root.dataset.mode = mode
    root.dataset.surface = appearance.surface
    root.dataset.density = appearance.density
    root.dataset.shadow = appearance.shadow
    root.dataset.zen = String(appearance.zenMode)
  }, [palette, accent, appearance, mode])

  return <>{children}</>
}
