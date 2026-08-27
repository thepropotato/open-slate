import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { setPath } from '@/core/util/path'
import type { Settings } from './schema'
import {
  flushSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  subscribeSettings,
} from './store'

export interface SettingsActions {
  /** Apply an immutable transform to the whole settings object. */
  update: (recipe: (current: Settings) => Settings) => void
  /** Set a single dot-path, e.g. `set('tiles.radius', 0)`. */
  set: (path: string, value: unknown) => void
  reset: () => Promise<void>
  replace: (next: Settings) => void
}

const SettingsContext = createContext<Settings | null>(null)
const ActionsContext = createContext<SettingsActions | null>(null)

export function SettingsProvider({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  /** Serialised copy of our own last write, so we can ignore the echo. */
  const lastWritten = useRef<string>('')

  useEffect(() => {
    let alive = true
    void loadSettings().then((loaded) => {
      if (!alive) return
      lastWritten.current = JSON.stringify(loaded)
      setSettings(loaded)
    })
    return () => {
      alive = false
    }
  }, [])

  // Keep every open tab and the options page in step.
  useEffect(() => {
    const unsubscribe = subscribeSettings((incoming) => {
      const serialised = JSON.stringify(incoming)
      if (serialised === lastWritten.current) return
      lastWritten.current = serialised
      setSettings(incoming)
    })
    return unsubscribe
  }, [])

  // Never lose a debounced write when the tab goes away.
  useEffect(() => {
    const flush = () => void flushSettings()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [])

  const commit = useCallback((next: Settings) => {
    lastWritten.current = JSON.stringify(next)
    setSettings(next)
    saveSettings(next)
  }, [])

  const actions = useMemo<SettingsActions>(
    () => ({
      update: (recipe) =>
        setSettings((current) => {
          if (!current) return current
          const next = recipe(current)
          lastWritten.current = JSON.stringify(next)
          saveSettings(next)
          return next
        }),
      set: (path, value) =>
        setSettings((current) => {
          if (!current) return current
          const next = setPath(current, path, value)
          lastWritten.current = JSON.stringify(next)
          saveSettings(next)
          return next
        }),
      reset: async () => {
        const fresh = await resetSettings()
        lastWritten.current = JSON.stringify(fresh)
        setSettings(fresh)
      },
      replace: commit,
    }),
    [commit],
  )

  if (!settings) return <>{fallback}</>

  return (
    <SettingsContext.Provider value={settings}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SettingsContext.Provider>
  )
}

export function useSettings(): Settings {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>')
  return value
}

export function useSettingsActions(): SettingsActions {
  const value = useContext(ActionsContext)
  if (!value) throw new Error('useSettingsActions must be used inside <SettingsProvider>')
  return value
}

/** Reads and writes one dot-path — the primitive the settings controls use. */
export function useSetting<T>(path: string): [T, (value: T) => void] {
  const settings = useSettings()
  const { set } = useSettingsActions()
  const read = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      settings,
    )
  return [read as T, useCallback((value: T) => set(path, value), [set, path])]
}
