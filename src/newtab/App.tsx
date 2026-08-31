import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { useSettingsSync } from '@/core/settings/useSettingsSync'
import { Icon } from '@/core/icons'
import type { Pane } from '@/core/settings/schema'

const CommandPalette = lazyChunk(() =>
  import('@/features/palette/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const SettingsOverlay = lazyChunk(() =>
  import('@/features/settings-ui/SettingsOverlay').then((m) => ({ default: m.SettingsOverlay })),
)
import { derivePanes, PageShell } from './PageShell'
import './App.css'

/**
 * The new tab. The markup lives in `PageShell` (the settings preview mounts it
 * too); this owns only what is true of the tab itself — shortcuts, the settings
 * cog, the palette, and the remembered pane.
 */
export function App() {
  const settings = useSettings()
  const { layout, appearance, behavior, widgets, tiles } = settings
  const { update } = useSettingsActions()
  useSettingsSync()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  // Gates the pane entrance animation on a real switch. A timer cannot work: panes
  // mount only once settings load, by which point a "first paint" flag has expired.
  const [switched, setSwitched] = useState(false)

  const paletteEnabled = behavior.commandPalette

  // A band switched off does not get a tab.
  const panes = useMemo(
    () => derivePanes({ layout, widgets, tiles }),
    [layout, widgets, tiles],
  )

  // Derived, not corrected in an effect: a remembered-but-disabled pane falls back
  // without an extra render and nothing is written back until the reader picks one.
  const preferred = layout.defaultPane === 'last' ? layout.lastPane : layout.defaultPane
  const [chosen, setChosen] = useState<Pane>(preferred)

  // The stored pane can change from outside (palette, sync pull). Following it during
  // render rather than in an effect avoids a paint with the two out of step.
  const [seenStored, setSeenStored] = useState(layout.lastPane)
  if (layout.lastPane !== seenStored) {
    setSeenStored(layout.lastPane)
    setChosen(layout.lastPane)
  }

  const active = panes.includes(chosen) ? chosen : (panes[0] ?? 'widgets')

  const showPane = useCallback(
    (pane: Pane) => {
      // Every pane change comes through here, so this marks a deliberate switch.
      setSwitched(true)
      setChosen(pane)
      update((current) => ({ ...current, layout: { ...current.layout, lastPane: pane } }))
      if (layout.viewMode === 'scroll') {
        // Every band is on the page already, so asking for one is a jump to it.
        const band = contentRef.current?.querySelector(`[data-band='${pane}']`)
        band?.scrollIntoView({ behavior: appearance.animations ? 'smooth' : 'auto', block: 'start' })
      }
    },
    [update, layout.viewMode, appearance.animations],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
      if (paletteEnabled && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
      // Keyed on `code` so the shortcut is the physical digit whatever the layout.
      const digit = /^Digit([12])$/.exec(event.code)
      if (digit) {
        const pane = panes[Number(digit[1]) - 1]
        if (!pane) return
        event.preventDefault()
        showPane(pane)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteEnabled, panes, showPane])

  return (
    <PageShell
      active={active}
      onSelectPane={showPane}
      switched={switched}
      contentRef={contentRef}
    >
      <button
        type="button"
        className="page__settings is-icon-btn"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        aria-label="Settings"
        data-zen={appearance.zenMode}
      >
        <Icon name="settings" />
      </button>

      {/* Mounted only while open, so its state starts fresh every time. */}
      {paletteEnabled && paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </Suspense>
      ) : null}

      {/* Mounted only while open, so the draft starts clean every time. */}
      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsOverlay onClose={() => setSettingsOpen(false)} />
        </Suspense>
      ) : null}
    </PageShell>
  )
}
