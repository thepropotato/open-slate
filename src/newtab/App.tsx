import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { useSettingsSync } from '@/core/settings/useSettingsSync'
import { Icon } from '@/core/icons'
import type { Pane } from '@/core/settings/schema'
import { BackgroundLayer } from '@/features/background/BackgroundLayer'

/** On demand: nothing about the palette is needed until it is opened. */
const CommandPalette = lazyChunk(() =>
  import('@/features/palette/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
import { SearchBar } from '@/features/search/SearchBar'
import { SettingsOverlay } from '@/features/settings-ui/SettingsOverlay'
import { TileGrid } from '@/features/tiles/TileGrid'
import { WidgetCanvas } from '@/features/widgets'
import { PaneSwitch } from './PaneSwitch'
import './App.css'

/**
 * The new tab shell. It owns nothing but the page frame: which bands appear, in
 * what order, and the two global keyboard entry points. Each band is a
 * self-contained feature that reads its own slice of settings.
 */
export function App() {
  const settings = useSettings()
  const { layout, appearance, behavior, widgets, tiles } = settings
  const { update } = useSettingsActions()
  useSettingsSync()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  const paletteEnabled = behavior.commandPalette
  const tabbed = layout.viewMode === 'tabs'

  /** The panes that actually exist; a band switched off does not get a tab. */
  const panes = useMemo(() => {
    const out: Pane[] = []
    if (widgets.enabled && layout.order.includes('widgets')) out.push('widgets')
    if (tiles.enabled && layout.order.includes('tiles')) out.push('tiles')
    return out
  }, [widgets.enabled, tiles.enabled, layout.order])

  /*
   * Derived rather than corrected in an effect: if the remembered pane has
   * since been switched off, the first surviving one is shown without an
   * extra render, and nothing is written back until the reader picks one.
   */
  const preferred = layout.defaultPane === 'last' ? layout.lastPane : layout.defaultPane
  const [chosen, setChosen] = useState<Pane>(preferred)

  /*
   * The stored pane can change from outside this component — the command
   * palette, or a sync pull from another device. Following it during render
   * rather than in an effect keeps the switch, the shortcuts and the palette
   * all pointing at the same pane without a wasted paint in between.
   */
  const [seenStored, setSeenStored] = useState(layout.lastPane)
  if (layout.lastPane !== seenStored) {
    setSeenStored(layout.lastPane)
    setChosen(layout.lastPane)
  }

  const active = panes.includes(chosen) ? chosen : (panes[0] ?? 'widgets')

  /*
   * The switch belongs to tabs only. On a single scrolling page every band is
   * already there to be scrolled to, so a control that picks one would be
   * decoration over the scrollbar — the shortcuts and the palette still jump.
   */
  const showSwitch = tabbed && panes.length > 1

  /*
   * Search leads, whatever the stored order says. It is the one thing that
   * belongs to both panes, and a tab opened to type a query should not have to
   * be scrolled past a dashboard first.
   */
  const bands = useMemo(
    () => [
      ...layout.order.filter((band) => band === 'search'),
      ...layout.order.filter((band) => band !== 'search'),
    ],
    [layout.order],
  )

  /** Where the switch goes: above the first band that it actually controls. */
  const firstPane = bands.find((band) => band !== 'search')

  const showPane = useCallback(
    (pane: Pane) => {
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
      if (event.key === 'Escape') setSettingsOpen(false)
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return
      // Comma with a modifier is the conventional "open preferences".
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen((open) => !open)
      }
      if (paletteEnabled && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
      // Modifier + 1/2 reaches a pane from anywhere, including inside a widget.
      if (event.key === '1' || event.key === '2') {
        const pane = panes[Number(event.key) - 1]
        if (!pane) return
        event.preventDefault()
        showPane(pane)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteEnabled, panes, showPane])

  return (
    <div className="page" data-align={layout.align} data-view={layout.viewMode}>
      <BackgroundLayer />

      <main
        className="page__content"
        ref={contentRef}
        style={{
          maxWidth: layout.maxWidth,
          paddingBlock: layout.paddingY,
          gap: layout.gap,
        }}
      >
        {/*
          The top of the page, as a snap point.
          Without one the only snap target is the band below the fold, and a
          scrolling page snaps straight down to it on load — the reader never
          sees the top. Out of flow, so it takes no space in the column.
        */}
        <div className="page__snaptop" aria-hidden="true" />

        {bands.map((band) =>
          band === 'search' ? (
            // Search sits outside the switch: it is the one thing you want on
            // both panes, so it never belongs to either.
            <Band key="search" name="search" />
          ) : (
            <Fragment key={band}>
              {/* Above the first switchable band, wherever the order puts it. */}
              {band === firstPane && showSwitch ? (
                <div className="page__switch">
                  <PaneSwitch active={active} panes={panes} onSelect={showPane} />
                </div>
              ) : null}
              <SwitchablePane
                name={band}
                active={active === band}
                tabbed={tabbed}
                first={band === bands[0]}
              >
                <Band name={band} />
              </SwitchablePane>
            </Fragment>
          ),
        )}
      </main>

      <button
        type="button"
        className="page__settings"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        aria-label="Settings"
        data-zen={appearance.zenMode}
      >
        <Icon name="settings" />
      </button>

      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Mounted only while open, so its state starts fresh every time. */}
      {paletteEnabled && paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setPaletteOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * One switchable band.
 *
 * The inactive pane is hidden rather than unmounted. A running timer, a
 * half-typed note and an open folder all live in component state, and none of
 * them should be thrown away because the reader glanced at their bookmarks.
 */
function SwitchablePane({
  name,
  active,
  tabbed,
  first,
  children,
}: {
  name: 'tiles' | 'widgets'
  active: boolean
  tabbed: boolean
  /**
   * Whether this is the topmost band on the page, which is not a snap target —
   * see the stylesheet. False for every pane when search leads, since then the
   * top of the page is the search box rather than a pane.
   */
  first: boolean
  children: ReactNode
}) {
  return (
    <div
      className="pane"
      data-band={name}
      data-active={active}
      data-first={first}
      hidden={tabbed && !active}
      aria-hidden={tabbed && !active}
    >
      {children}
    </div>
  )
}

/** Band router. Each band is a feature that reads its own slice of settings. */
function Band({ name }: { name: 'search' | 'tiles' | 'widgets' }) {
  if (name === 'tiles') return <TileGrid />
  if (name === 'widgets') return <WidgetCanvas />
  if (name === 'search') return <SearchBar />
  return null
}
