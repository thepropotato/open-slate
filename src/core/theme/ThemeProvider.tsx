import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import type { Settings } from '@/core/settings/schema'
import { accentStore } from './accentStore'
import type { Palette } from './presets'
import {
  resolveAccent,
  resolveMode,
  resolvePalette,
  themeFlags,
  themeVars,
} from './themeVars'

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
  return resolveMode(appearance.mode, usePrefersDark())
}

/** For the rare case a component needs real colour maths. */
export function usePalette(): Palette {
  const { appearance } = useSettings()
  return resolvePalette(appearance, useResolvedMode())
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { appearance } = useSettings()
  const mode = useResolvedMode()
  const sampledAccent = useSyncExternalStore(accentStore.subscribe, accentStore.get, () => null)

  const palette = resolvePalette(appearance, mode)
  const accent = useMemo(
    () => resolveAccent(appearance, palette, sampledAccent),
    [appearance, palette, sampledAccent],
  )

  useEffect(() => {
    const root = document.documentElement
    const vars = themeVars(appearance, palette, accent)
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)

    root.style.colorScheme = mode
    for (const [key, value] of Object.entries(themeFlags(appearance, mode))) {
      root.dataset[key] = value
    }
  }, [palette, accent, appearance, mode])

  return <>{children}</>
}

/**
 * A themed container, for showing one appearance inside a page themed by another.
 * `ThemeProvider` owns the single `:root`, so a preview paints the same variables,
 * from the same function, onto a wrapper instead.
 */
export function ThemeScope({
  appearance,
  className,
  children,
}: {
  appearance: ReturnType<typeof useSettings>['appearance']
  className?: string
  children: ReactNode
}) {
  const prefersDark = usePrefersDark()
  const mode = resolveMode(appearance.mode, prefersDark)
  const sampledAccent = useSyncExternalStore(accentStore.subscribe, accentStore.get, () => null)

  const palette = resolvePalette(appearance, mode)
  const accent = resolveAccent(appearance, palette, sampledAccent)
  const flags = themeFlags(appearance, mode)

  return (
    <div
      className={className}
      style={{ ...themeVars(appearance, palette, accent), colorScheme: mode } as React.CSSProperties}
      data-mode={flags.mode}
      data-surface={flags.surface}
      data-density={flags.density}
      data-shadow={flags.shadow}
      data-zen={flags.zen}
    >
      {children}
    </div>
  )
}

/** Resolves an arbitrary (typically draft) mode, for chrome previewing a theme it is not drawn in. */
export function usePreviewMode(mode: Settings['appearance']['mode']): 'light' | 'dark' {
  return resolveMode(mode, usePrefersDark())
}
