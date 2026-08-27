import { useEffect, useState } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import { Icon } from '@/core/icons'
import { SettingsOverlay } from '@/features/settings-ui/SettingsOverlay'
import './App.css'

/**
 * The new tab shell. It owns nothing but the page frame: which bands appear, in
 * what order, and how the settings overlay opens. Each band is a self-contained
 * feature that reads its own slice of settings.
 */
export function App() {
  const { layout, appearance } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
      // Comma with a modifier is the conventional "open preferences".
      if (event.key === ',' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSettingsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="page" data-align={layout.align}>
      <div className="page__background" />

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
    </div>
  )
}

/** Placeholder band router — each phase replaces one of these with the real thing. */
function Band({ name }: { name: 'search' | 'tiles' | 'widgets' }) {
  return <section className={`band band--${name}`} data-band={name} />
}
