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
import { getPath, setPath } from '@/core/util/path'
import type { Settings } from './schema'
import { isStagedPath, stagedDiff } from './staged'
import {
  flushSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  subscribeSettings,
} from './store'

export interface SettingsActions {
  update: (recipe: (current: Settings) => Settings) => void
  /** Set a single dot-path, e.g. `set('tiles.radius', 0)`. */
  set: (path: string, value: unknown) => void
  reset: () => Promise<void>
  replace: (next: Settings) => void
}

/** Editing a staged draft: what the settings UI and its preview work against. */
export interface DraftActions {
  /** Staged paths differing from what is saved. Empty means nothing to save. */
  changed: string[]
  dirty: boolean
  save: () => void
  discard: () => void
  /** Restores one path to its saved value, leaving the rest of the draft alone. */
  revert: (path: string) => void
}

const SettingsContext = createContext<Settings | null>(null)
const ActionsContext = createContext<SettingsActions | null>(null)
const DraftContext = createContext<Settings | null>(null)
const DraftActionsContext = createContext<DraftActions | null>(null)

export function SettingsProvider({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  // Unsaved edits to staged paths; `null` when there are none.
  const [draft, setDraft] = useState<Settings | null>(null)
  // Our own last write, so we can ignore the echo.
  const lastWritten = useRef<string>('')
  // Mirrors `settings` so a staged write can read what is saved without making
  // `actions` depend on it. Kept in step by `writeSettings`, the single writer.
  const savedRef = useRef<Settings | null>(null)

  /**
   * The only place `settings` is set, so the ref can never drift from the state.
   * The next value is resolved against the ref rather than inside the updater:
   * React replays updaters, and anything but a pure one is applied more than once.
   */
  const writeSettings = useCallback(
    (next: Settings | null | ((current: Settings | null) => Settings | null)) => {
      const value = typeof next === 'function' ? next(savedRef.current) : next
      savedRef.current = value
      setSettings(value)
      return value
    },
    [],
  )

  useEffect(() => {
    let alive = true
    void loadSettings().then((loaded) => {
      if (!alive) return
      lastWritten.current = JSON.stringify(loaded)
      writeSettings(loaded)
    })
    return () => {
      alive = false
    }
  }, [writeSettings])

  // Keep every open tab and the options page in step.
  useEffect(() => {
    const unsubscribe = subscribeSettings((incoming) => {
      const serialised = JSON.stringify(incoming)
      if (serialised === lastWritten.current) return
      lastWritten.current = serialised
      // Read the outgoing values before replacing them; the rebase needs both.
      const previous = savedRef.current
      writeSettings(incoming)
      // Rebase the draft so an incoming change does not eat edits in progress.
      setDraft((current) => (current && previous ? rebase(previous, current, incoming) : current))
    })
    return unsubscribe
  }, [writeSettings])

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
    writeSettings(next)
    saveSettings(next)
    // A wholesale replacement is the new truth; a draft against the old one is meaningless.
    setDraft(null)
  }, [writeSettings])

  const actions = useMemo<SettingsActions>(
    () => ({
      // A whole-object recipe says nothing about which paths it touches, so it always commits.
      update: (recipe) =>
        writeSettings((current) => {
          if (!current) return current
          const next = recipe(current)
          lastWritten.current = JSON.stringify(next)
          saveSettings(next)
          return next
        }),
      set: (path, value) => {
        if (isStagedPath(path)) {
          // Read the saved values off the ref, never from inside a `setSettings`
          // updater: React replays those, and an enqueued `setDraft` would be
          // replayed with them, re-applying a value the reader had moved past.
          setDraft((current) => {
            const base = current ?? savedRef.current
            if (!base) return current
            return setPath(base, path, value)
          })
          return
        }
        writeSettings((current) => {
          if (!current) return current
          const next = setPath(current, path, value)
          lastWritten.current = JSON.stringify(next)
          saveSettings(next)
          return next
        })
      },
      reset: async () => {
        const fresh = await resetSettings()
        lastWritten.current = JSON.stringify(fresh)
        writeSettings(fresh)
        setDraft(null)
      },
      replace: commit,
    }),
    [commit, writeSettings],
  )

  const effective = draft ?? settings

  const changed = useMemo(
    () => (settings && draft ? stagedDiff(settings, draft) : []),
    [settings, draft],
  )

  const draftActions = useMemo<DraftActions>(
    () => ({
      changed,
      dirty: changed.length > 0,
      save: () => {
        if (!draft) return
        lastWritten.current = JSON.stringify(draft)
        writeSettings(draft)
        saveSettings(draft)
        // Flush rather than wait out the debounce, so other tabs see it now.
        void flushSettings()
        setDraft(null)
      },
      discard: () => setDraft(null),
      revert: (path) =>
        setDraft((current) => {
          if (!current || !settings) return current
          const next = setPath(current, path, getPath(settings, path))
          return stagedDiff(settings, next).length === 0 ? null : next
        }),
    }),
    [changed, draft, settings, writeSettings],
  )

  if (!settings || !effective) return <>{fallback}</>

  return (
    <SettingsContext.Provider value={settings}>
      <ActionsContext.Provider value={actions}>
        <DraftContext.Provider value={effective}>
          <DraftActionsContext.Provider value={draftActions}>
            {children}
          </DraftActionsContext.Provider>
        </DraftContext.Provider>
      </ActionsContext.Provider>
    </SettingsContext.Provider>
  )
}

/** Carries draft edits across a change written by another tab. */
function rebase(previousSaved: Settings, draft: Settings, incoming: Settings): Settings | null {
  const edited = stagedDiff(previousSaved, draft)
  if (edited.length === 0) return null
  let next = incoming
  for (const path of edited) next = setPath(next, path, getPath(draft, path))
  return next
}

/** The saved settings the app runs on, never a draft. The settings UI uses `useDraftSettings`. */
export function useSettings(): Settings {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>')
  return value
}

/** Saved values with any unsaved edits applied - what the settings UI edits. */
export function useDraftSettings(): Settings {
  const value = useContext(DraftContext)
  if (!value) throw new Error('useDraftSettings must be used inside <SettingsProvider>')
  return value
}

export function useDraftActions(): DraftActions {
  const value = useContext(DraftActionsContext)
  if (!value) throw new Error('useDraftActions must be used inside <SettingsProvider>')
  return value
}

export function useSettingsActions(): SettingsActions {
  const value = useContext(ActionsContext)
  if (!value) throw new Error('useSettingsActions must be used inside <SettingsProvider>')
  return value
}

/**
 * Renders `children` as though `settings` were saved, so the preview runs the real
 * components rather than a second implementation. Writes are dropped.
 */
export function SettingsOverride({
  settings,
  children,
}: {
  settings: Settings
  children: ReactNode
}) {
  const actions = useMemo<SettingsActions>(
    () => ({
      update: () => {},
      set: () => {},
      reset: async () => {},
      replace: () => {},
    }),
    [],
  )

  return (
    <SettingsContext.Provider value={settings}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SettingsContext.Provider>
  )
}

/** Reads and writes one dot-path; the primitive the settings controls use. */
export function useSetting<T>(path: string): [T, (value: T) => void] {
  const settings = useDraftSettings()
  const { set } = useSettingsActions()
  const read = getPath<T>(settings, path)
  return [read as T, useCallback((value: T) => set(path, value), [set, path])]
}
