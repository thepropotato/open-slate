import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { SettingsOverride, useDraftSettings } from '@/core/settings/SettingsProvider'
import { ThemeScope } from '@/core/theme/ThemeProvider'
import { derivePanes, PageShell } from '@/newtab/PageShell'
import type { Pane } from '@/core/settings/schema'
import './SettingsPreview.css'

/**
 * Live preview of the pending settings, rendering the real feature components
 * under a `SettingsOverride` holding the draft.
 *
 * `ThemeScope` paints the draft's tokens onto the wrapper, since `:root` belongs
 * to the saved theme. The frame is laid out at a real window's size and scaled
 * down: at the column's actual width, every width-dependent rule (content cap,
 * tile columns, narrow-window stack) would resolve at a size no window has.
 */

// The reader's own window, not a constant: whether `layout.maxWidth` binds is
// exactly the question of how wide their window is. Read once per mount.
const readFrame = () => ({
  width: Math.round(window.innerWidth),
  height: Math.round(window.innerHeight),
})

// Matches the `@container` threshold in `SettingsPanel.css`. Hiding in CSS alone
// would leave a second copy of the page mounted and running behind `display: none`.
const MIN_PANEL_REM = 64

// Multiples of the fit-to-column scale, not absolute: 1x is "the whole page".
const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 1.25
const clampZoom = (zoom: number) => Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX)

export function SettingsPreview() {
  const draft = useDraftSettings()
  const { layout } = draft

  const shellRef = useRef<HTMLDivElement>(null)
  // Measured from the panel, in the stylesheet's units, so the two can't disagree.
  const [roomy, setRoomy] = useState(true)
  useEffect(() => {
    // Measure the panel, never this element: the probe left behind is hidden, and
    // a hidden element reports no width, so it could never decide to come back.
    const shell = shellRef.current?.closest('.settings-shell')
    if (!shell) return
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const observer = new ResizeObserver(([entry]) => {
      setRoomy(entry.contentRect.width >= MIN_PANEL_REM * rem)
    })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  const hostRef = useRef<HTMLDivElement>(null)
  // Kept apart: storing only the product would let every column resize overwrite
  // the reader's zoom, since `fit` is recomputed on each one.
  const [fit, setFit] = useState(0)
  const [zoom, setZoom] = useState(1)
  const scale = fit * zoom

  // Viewport centre at the moment of zooming, in unscaled frame coordinates, so
  // zoom holds it still. Captured on the click: by the effect below the box has
  // already been laid out at the new scale and the old centre is gone.
  const anchorRef = useRef<{ x: number; y: number } | null>(null)

  const zoomTo = (next: (current: number) => number) => {
    const target = clampZoom(next(zoom))
    if (target === zoom) return
    // Read outside the state updater: React calls updaters twice in development,
    // and a second reading would measure a box the first had already moved.
    const host = hostRef.current
    if (host && scale) {
      anchorRef.current = {
        x: (host.scrollLeft + host.clientWidth / 2) / scale,
        y: (host.scrollTop + host.clientHeight / 2) / scale,
      }
    }
    setZoom(target)
  }

  // Layout effect, not effect: the correction lands in the same paint as the
  // resize, so the browser's own scroll position is never seen.
  useLayoutEffect(() => {
    const host = hostRef.current
    const anchor = anchorRef.current
    if (!host || !anchor || !scale) return
    anchorRef.current = null
    host.scrollLeft = anchor.x * scale - host.clientWidth / 2
    host.scrollTop = anchor.y * scale - host.clientHeight / 2
  }, [scale])

  const [frame] = useState(readFrame)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // Measured directly as well as observed: `ResizeObserver` reports zero for an
    // element mounting into a grid track that is itself appearing.
    const measure = (width: number, height: number) => {
      if (!width || !height) return
      setFit(Math.min(width / frame.width, height / frame.height))
    }

    // Content box, matching what the observer reports. The border box would count
    // the host's padding as room for the frame, so the preview opens overflowing.
    const style = getComputedStyle(host)
    measure(
      host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      host.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
    )

    const observer = new ResizeObserver(([entry]) => {
      measure(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [frame, roomy])

  // The preview owns its pane; a glance here must not move the reader's real tab.
  const panes = derivePanes(draft)
  const tabbed = layout.viewMode === 'tabs'
  const preferred = layout.defaultPane === 'last' ? layout.lastPane : layout.defaultPane
  const [chosen, setChosen] = useState<Pane>(preferred)
  const active = panes.includes(chosen) ? chosen : (panes[0] ?? 'widgets')

  // A probe stays in the tree so the panel's width is still watched.
  if (!roomy) return <div className="preview__probe" ref={shellRef} aria-hidden="true" />

  return (
    <div className="preview" ref={shellRef}>
      <div className="preview__head">
        <span className="preview__title">
          <Icon name="window" /> Preview
        </span>
        {tabbed && panes.length > 1 ? (
          <div className="preview__panes" role="group" aria-label="Preview pane">
            {panes.map((pane) => (
              <button
                key={pane}
                type="button"
                className="preview__pane"
                aria-pressed={pane === active}
                onClick={() => setChosen(pane)}
              >
                {pane === 'widgets' ? 'Widgets' : 'Tiles'}
              </button>
            ))}
          </div>
        ) : null}

        <div className="preview__zoom" role="group" aria-label="Preview zoom">
          <button
            type="button"
            className="preview__zoombtn is-icon-btn"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => zoomTo((z) => z / ZOOM_STEP)}
          >
            <Icon name="zoomOut" />
          </button>
          <button
            type="button"
            className="preview__zoomlevel"
            title="Reset to fit"
            aria-label="Reset zoom to fit"
            disabled={zoom === 1}
            onClick={() => zoomTo(() => 1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="preview__zoombtn is-icon-btn"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => zoomTo((z) => z * ZOOM_STEP)}
          >
            <Icon name="zoomIn" />
          </button>
        </div>
      </div>

      {/* Scrolls only once zoomed past the fit: at 1x the frame is exactly this box. */}
      <div className="preview__host" data-zoomed={zoom > 1} ref={hostRef}>
        {/* Takes the scaled footprint; the frame inside keeps its real size. */}
        <div
          className="preview__fit"
          style={{
            width: frame.width * scale,
            height: frame.height * scale,
            // Hidden until measured, so it never flashes at full size.
            visibility: scale ? 'visible' : 'hidden',
          }}
        >
        <div
          className="preview__frame"
          style={{
            width: frame.width,
            height: frame.height,
            transform: `scale(${scale})`,
          }}
        >
          {/* Everything inside is a real focusable control; a picture of the page
              must not be a second place to click or a keyboard detour. */}
          <div className="preview__inert" aria-hidden="true" inert>
            <ThemeScope appearance={draft.appearance} className="preview__theme">
              {/* The shell and every feature inside read `useSettings()`; here that
                  returns the draft. */}
              <SettingsOverride settings={draft}>
                <PageShell active={active} />
              </SettingsOverride>
            </ThemeScope>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

