import { useCallback, useEffect, useRef } from 'react'
import { useSettings, useSettingsActions } from './SettingsProvider'
import { noteLocalChange, pullSettings, pushSettings, readSyncState, subscribeSync } from './sync'

// Wait after the last change before pushing, to stay well inside quota.
const PUSH_DEBOUNCE_MS = 8000

/**
 * Pulls on load and on remote pushes; pushes debounced after local changes. A
 * remote copy older than this device's last change is refused, so offline edits survive.
 */
export function useSettingsSync(): void {
  const settings = useSettings()
  const { replace } = useSettingsActions()

  const enabled = settings.sync.enabled && settings.sync.auto

  // A ref, not a dependency, so the subscription is not rebuilt on every keystroke.
  const latest = useRef(settings)
  useEffect(() => {
    latest.current = settings
  }, [settings])

  // What we last saw, so a pull is not pushed straight back.
  const lastSeen = useRef('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pull = useCallback(async () => {
    const state = await readSyncState()
    const result = await pullSettings(latest.current)
    if (!result || result.at <= state.lastLocalChangeAt) return
    lastSeen.current = JSON.stringify(result.settings)
    replace(result.settings)
  }, [replace])

  // Pull on load, and whenever another device pushes.
  useEffect(() => {
    if (!enabled) return
    void pull()
    return subscribeSync(() => void pull())
  }, [enabled, pull])

  // Push, debounced, after this device changes something.
  useEffect(() => {
    if (!enabled) return
    const serialised = JSON.stringify(settings)
    if (serialised === lastSeen.current) return
    lastSeen.current = serialised

    void noteLocalChange()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void pushSettings(settings), PUSH_DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [enabled, settings])
}
