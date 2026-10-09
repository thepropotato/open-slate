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
import { ArrangeProvider, useArrange } from '@/features/menu/ArrangeContext'
import { useArrangeEscape } from '@/features/menu/arrange'
import { useContextMenu } from '@/features/menu/useContextMenu'
import type { MenuItem } from '@/features/menu/ContextMenu'
import { derivePanes, PageShell } from './PageShell'
import { TopAddButton } from './TopAddButton'
import './App.css'

/**
 * The new tab. The markup lives in `PageShell` (the settings preview mounts it
 * too); this owns only what is true of the tab itself - shortcuts, the settings
 * cog, the palette, and the remembered pane.
 */
export function App() {
  return (
    <ArrangeProvider>
      <NewTab />
    </ArrangeProvider>
  )
}

function NewTab() {
  const settings = useSettings()
  const { layout, appearance, behavior, widgets, tiles } = settings
  const { update } = useSettingsActions()
  useSettingsSync()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined)
  const contentRef = useRef<HTMLElement>(null)
  const arrange = useArrange()

  const openSettings = useCallback((section?: string) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }, [])

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

  // Settings is the heaviest chunk on the page and nothing fetches it until it is
  // asked for, so the first open pays the whole download. Warm it once the tab has
  // gone idle, which is off the first-paint path and long before any click.
  useEffect(() => {
    const warm = () => {
      SettingsOverlay.preload()
      if (paletteEnabled) CommandPalette.preload()
    }
    // `requestIdleCallback` is in every Chrome this extension targets; the timeout
    // keeps a permanently busy tab from starving the warm-up indefinitely.
    const id = requestIdleCallback(warm, { timeout: 2000 })
    return () => cancelIdleCallback(id)
  }, [paletteEnabled])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey

      // Entry cost is what sank the old arrange mode, so it gets a bare key.
      if (!modifier && !event.altKey && event.key.toLowerCase() === 'e' && !isTyping(event.target)) {
        event.preventDefault()
        arrange.start()
        return
      }

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
  }, [paletteEnabled, panes, showPane, arrange])

  useArrangeEscape(arrange.arranging, arrange.stop)

  const buildPageMenu = useCallback(
    (event: React.MouseEvent): MenuItem[] => {
      if (event.defaultPrevented) return []
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return []

      return [
        {
          id: 'arrange',
          label: arrange.arranging ? 'Done arranging' : 'Arrange the page',
          icon: arrange.arranging ? 'check' : 'drag',
          onSelect: arrange.arranging ? arrange.stop : arrange.start,
        },
        {
          id: 'wallpaper',
          label: 'Change wallpaper',
          icon: 'image',
          separatorBefore: true,
          onSelect: () => openSettings('background'),
        },
        ...(paletteEnabled
          ? [
              {
                id: 'palette',
                label: 'Command palette',
                icon: 'search' as const,
                onSelect: () => setPaletteOpen(true),
              },
            ]
          : []),
        {
          id: 'settings',
          label: 'Settings',
          icon: 'settings',
          onSelect: () => openSettings(),
        },
      ]
    },
    [arrange, openSettings, paletteEnabled],
  )

  const pageMenu = useContextMenu(buildPageMenu)

  // Ensure Chrome's default context menu is never shown anywhere on the new tab page,
  // except when interacting directly with editable text fields.
  useEffect(() => {
    const onWindowContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
    }
    window.addEventListener('contextmenu', onWindowContext)
    return () => window.removeEventListener('contextmenu', onWindowContext)
  }, [])

  return (
    <PageShell
      active={active}
      onSelectPane={showPane}
      switched={switched}
      contentRef={contentRef}
      onContextMenu={pageMenu.onContextMenu}
    >
      <div className="page__tools" data-zen={appearance.zenMode}>
        <TopAddButton
          active={active}
          panes={panes}
          viewMode={layout.viewMode}
          direction="up"
          onSelectPane={showPane}
        />

        {/* Right-click and the E key are both invisible; this is the one way
            in that can be seen, and the same button is the way back out. */}
        <button
          type="button"
          className="page__arrange is-icon-btn"
          onClick={arrange.arranging ? arrange.stop : arrange.start}
          title={arrange.arranging ? 'Done arranging' : 'Arrange the page'}
          aria-label={arrange.arranging ? 'Done arranging' : 'Arrange the page'}
          aria-pressed={arrange.arranging}
          data-active={arrange.arranging}
        >
          <Icon name={arrange.arranging ? 'check' : 'drag'} />
        </button>

        <button
          type="button"
          className="page__settings is-icon-btn"
          onClick={() => openSettings()}
          // A pointer on its way to the cog is the last chance to beat the click.
          onPointerEnter={() => SettingsOverlay.preload()}
          onFocus={() => SettingsOverlay.preload()}
          title="Settings"
          aria-label="Settings"
        >
          <Icon name="settings" />
        </button>
      </div>

      {pageMenu.menu}

      {/* Mounted only while open, so its state starts fresh every time. */}
      {paletteEnabled && paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            onOpenSettings={() => openSettings()}
            onArrange={arrange.start}
          />
        </Suspense>
      ) : null}

      {/* Mounted only while open, so the draft starts clean every time. */}
      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsOverlay
            initialSection={settingsSection}
            onClose={() => {
              setSettingsOpen(false)
              setSettingsSection(undefined)
            }}
          />
        </Suspense>
      ) : null}
    </PageShell>
  )
}

/** A bare letter shortcut must not steal the key from anything taking text. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element?.tagName) return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}
