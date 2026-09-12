import { Fragment, type ReactNode } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import { BackgroundLayer } from '@/features/background/BackgroundLayer'
import { SearchBar } from '@/features/search/SearchBar'
import { TileGrid } from '@/features/tiles/TileGrid'
import { WidgetCanvas } from '@/features/widgets'
import type { Pane } from '@/core/settings/schema'
import { PaneSwitch } from './PaneSwitch'
import './App.css'

/**
 * The page itself: which bands appear, in what order, and how they are wrapped.
 * Mounted by both the new tab and the settings preview, so the two cannot drift.
 * Anything a picture of the page must not do (shortcuts, sync, clicks) is passed in.
 */
export function PageShell({
  active,
  onSelectPane,
  switched = false,
  contentRef,
  children,
}: {
  active: Pane
  /** Omitted by the preview, which takes the switch out of the tab order instead. */
  onSelectPane?: (pane: Pane) => void
  /** Whether a real tab switch has happened; gates the entrance animation. */
  switched?: boolean
  contentRef?: React.Ref<HTMLElement>
  /** Page-level chrome the new tab adds and the preview does not. */
  children?: ReactNode
}) {
  const { layout, widgets, tiles } = useSettings()

  const panes = derivePanes({ layout, widgets, tiles })
  const tabbed = layout.viewMode === 'tabs'
  const showSwitch = tabbed && panes.length > 1
  const bands = orderBands(layout.order)
  const firstPane = bands.find((band) => band !== 'search')

  return (
    <div
      className="page"
      data-align={layout.align}
      data-view={layout.viewMode}
      data-switched={switched}
    >
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
        {/* Snap point for the top: without it a scrolling page snaps past the top on load. */}
        <div className="page__snaptop" aria-hidden="true" />

        {bands.map((band) => {
          // Search sits outside the switch: it belongs to both panes.
          if (band === 'search') return <Band key="search" name="search" />

          // Every pane is rendered at the first one's position, so the stored
          // order still decides whether the panes sit above or below search.
          if (tabbed && band !== firstPane) return null

          return (
            <Fragment key={band}>
              {/* Above the first switchable band, wherever the order puts it. */}
              {band === firstPane && showSwitch ? (
                <div className="page__switch">
                  <PaneSwitch active={active} panes={panes} onSelect={onSelectPane} />
                </div>
              ) : null}

              {tabbed ? (
                /*
                 * One grid cell holds every pane, so the column is as tall as the
                 * tallest of them whichever is showing. Switching from two widgets
                 * to thirty tiles would otherwise resize the centred column and
                 * walk the search bar up the page.
                 */
                <div className="page__panes">
                  {panes.map((pane) => (
                    <SwitchablePane key={pane} name={pane} active={active === pane} tabbed first>
                      <Band name={pane} />
                    </SwitchablePane>
                  ))}
                </div>
              ) : (
                <SwitchablePane
                  name={band}
                  active={active === band}
                  tabbed={false}
                  first={band === bands[0]}
                >
                  <Band name={band} />
                </SwitchablePane>
              )}
            </Fragment>
          )
        })}
      </main>

      {children}
    </div>
  )
}

/**
 * The panes that actually exist; a band switched off does not get a tab. A plain
 * function, not a hook, so the preview can ask it about its unsaved draft.
 */
export function derivePanes({
  layout,
  widgets,
  tiles,
}: Pick<ReturnType<typeof useSettings>, 'layout' | 'widgets' | 'tiles'>): Pane[] {
  const out: Pane[] = []
  if (widgets.enabled && layout.order.includes('widgets')) out.push('widgets')
  if (tiles.enabled && layout.order.includes('tiles')) out.push('tiles')
  return out
}

/** The two panes, plus search, which is neither. */
type BandName = Pane | 'search'

/** Search leads, whatever the stored order says. */
export function orderBands(order: readonly BandName[]): BandName[] {
  return [
    ...order.filter((band) => band === 'search'),
    ...order.filter((band) => band !== 'search'),
  ]
}

/** The inactive pane is hidden, not unmounted: timers, drafts and open folders
 * live in component state. */
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
  /** The topmost band is not a snap target - see the stylesheet. */
  first: boolean
  children: ReactNode
}) {
  const away = tabbed && !active
  return (
    <div
      className="pane"
      data-band={name}
      data-active={active}
      data-first={first}
      /*
       * Hidden by visibility rather than `hidden`, so the pane keeps its grid
       * cell and goes on contributing height. A display:none pane also reports
       * no width, which left the widget grid measuring its columns against
       * nothing until it was next looked at.
       */
      inert={away || undefined}
      aria-hidden={away}
    >
      {children}
    </div>
  )
}

/** Band router. */
function Band({ name }: { name: BandName }) {
  if (name === 'tiles') return <TileGrid />
  if (name === 'widgets') return <WidgetCanvas />
  if (name === 'search') return <SearchBar />
  return null
}
