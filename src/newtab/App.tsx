import { Suspense, lazy, useEffect, useState } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import { Icon } from '@/core/icons'
import { BackgroundLayer } from '@/features/background/BackgroundLayer'

/** On demand: nothing about the palette is needed until it is opened. */
const CommandPalette = lazy(() =>
  import('@/features/palette/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
import { SearchBar } from '@/features/search/SearchBar'
import { SettingsOverlay } from '@/features/settings-ui/SettingsOverlay'
import { TileGrid } from '@/features/tiles/TileGrid'
import { WidgetCanvas } from '@/features/widgets'
import './App.css'

/**
 * The new tab shell. It owns nothing but the page frame: which bands appear, in
 * what order, and the two global keyboard entry points. Each band is a
 * self-contained feature that reads its own slice of settings.
 */
export function App() {
  const { layout, appearance, behavior } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const paletteEnabled = behavior.commandPalette

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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteEnabled])

  return (
    <div className="page" data-align={layout.align}>
      <BackgroundLayer />

      <main
        className="page__content"
        style={{
          maxWidth: layout.maxWidth,
          paddingBlock: layout.paddingY,
          gap: layout.gap,
        }}
      >
        {layout.order.map((band) => (
          <Band key={band} name={band} />
        ))}
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

/** Band router. Each band is a feature that reads its own slice of settings. */
function Band({ name }: { name: 'search' | 'tiles' | 'widgets' }) {
  if (name === 'tiles') return <TileGrid />
  if (name === 'widgets') return <WidgetCanvas />
  if (name === 'search') return <SearchBar />
  return null
}
