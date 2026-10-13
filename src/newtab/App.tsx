import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { DraftPreview, useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { applySlate } from '@/core/settings/slateCode'
import { getSceneCursor, listScenes, sceneFor, setSceneCursor } from '@/core/settings/scenes'
import { getWidget } from '@/core/widgets/registry'
import { uid } from '@/core/util/id'
import { useSettingsSync } from '@/core/settings/useSettingsSync'
import { triggerAdd, type AddTab } from '@/core/events'
import type { Pane } from '@/core/settings/schema'

const CommandPalette = lazyChunk(() =>
  import('@/features/palette/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const AddSheet = lazyChunk(() =>
  import('@/features/add/AddSheet').then((m) => ({ default: m.AddSheet })),
)
const SettingsOverlay = lazyChunk(() =>
  import('@/features/settings-ui/SettingsOverlay').then((m) => ({ default: m.SettingsOverlay })),
)
import { ArrangeProvider, useArrange } from '@/features/menu/ArrangeContext'
import { useArrangeEscape } from '@/features/menu/arrange'
import { useContextMenu } from '@/features/menu/useContextMenu'
import type { MenuItem } from '@/features/menu/ContextMenu'
import { derivePanes, PageShell } from './PageShell'
import { ArrangeBanner, Dock } from './Dock'
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
  const [deepLink] = useState(readDeepLink)
  const [paletteOpen, setPaletteOpen] = useState(deepLink.command === 'palette')
  const [settingsOpen, setSettingsOpen] = useState(deepLink.command === 'settings')
  const [adding, setAdding] = useState<{ tab: AddTab; pageId: string } | null>(
    deepLink.command === 'add' ? { tab: 'tile', pageId: '' } : null,
  )
  const [settingsSection, setSettingsSection] = useState<string | undefined>(deepLink.argument)
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

  // A scene whose schedule covers right now is applied once when its window starts. Opening a
  // tab later in the same window leaves the layout alone, so manual changes are not undone.
  useEffect(() => {
    void (async () => {
      const match = sceneFor(await listScenes(), new Date())
      const cursor = await getSceneCursor()
      if (!match) {
        if (cursor) await setSceneCursor(null)
        return
      }
      if (match.id === cursor) return
      await setSceneCursor(match.id)
      update((current) => applySlate(current, match.code, uid, (type) => getWidget(type) !== undefined))
    })()
  }, [update])

  // The popup's actions that start settings or arrange mode run once the page has mounted.
  const startedFromLink = useRef(false)
  useEffect(() => {
    if (startedFromLink.current || deepLink.command !== 'arrange') return
    startedFromLink.current = true
    arrange.start()
  }, [arrange, deepLink.command])

  useEffect(() => {
    const onAdd = (event: Event) => {
      const { tab, pageId } = (event as CustomEvent<{ tab: AddTab; pageId: string }>).detail
      setAdding({ tab, pageId })
    }
    window.addEventListener('open-slate:add', onAdd)
    return () => window.removeEventListener('open-slate:add', onAdd)
  }, [])

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
    <>
      <DraftPreview active={settingsOpen}>
      <PageShell
      active={active}
      onSelectPane={showPane}
      switched={switched}
      contentRef={contentRef}
      onContextMenu={pageMenu.onContextMenu}
      drawerOpen={settingsOpen}
    >
      <Dock
        arranging={arrange.arranging}
        zen={appearance.zenMode}
        onAdd={() => triggerAdd(active === 'widgets' && layout.viewMode === 'tabs' ? 'widget' : 'tile')}
        onArrange={arrange.arranging ? arrange.stop : arrange.start}
        onSettings={() => openSettings()}
        onWarm={() => SettingsOverlay.preload()}
      />
      {arrange.arranging ? <ArrangeBanner onDone={arrange.stop} /> : null}

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

      </PageShell>
      </DraftPreview>

      {adding ? (
        <Suspense fallback={null}>
          <AddSheet initialTab={adding.tab} pageId={adding.pageId} onClose={() => setAdding(null)} />
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
    </>
  )
}

/** The toolbar popup opens newtab.html#settings, #settings=background, #arrange or #palette. */
function readDeepLink(): { command: string; argument: string | undefined } {
  const [command = '', argument] = location.hash.slice(1).split('=')
  if (command) history.replaceState(null, '', location.pathname + location.search)
  return { command, argument: argument || undefined }
}

/** A bare letter shortcut must not steal the key from anything taking text. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element?.tagName) return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}
