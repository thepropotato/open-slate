import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { isExtension } from '@/core/platform/browser'
import { hasSpotifyAccess, SPOTIFY_PERMISSIONS } from './api'
import { isSignedIn, signOut } from './auth'
import { ART_ORIGIN, isConfigured, SPOTIFY_ORIGINS, subscribeClientId } from './config'
import { guideUrl } from '@/features/setup/registry'
import { NowPlaying } from './NowPlaying'
import './spotify.css'

const SpotifyConfig = z.object({
  showArt: z.boolean().default(true),
  fillArt: z.boolean().default(true),
})
type SpotifyConfig = z.infer<typeof SpotifyConfig>

// Connecting needs a client ID, the host permission and Spotify's own consent.
// All three are handled by the setup page, so the widget only shows the door.
type Phase = 'checking' | 'needs-connect' | 'ready'

function SpotifyWidget({ config, sizeName }: WidgetProps<SpotifyConfig>) {
  // `null` until the gates have been checked; set directly once connecting or
  // signing out has moved the widget on from whatever was resolved.
  const [override, setOverride] = useState<Phase | null>(null)

  const resolved = useAsyncValue<Phase>('spotify-phase', async () => {
    // Outside the extension the dev stub renders, so neither gate applies and a
    // missing client ID does not matter - there is nothing to sign in to.
    if (!isExtension()) return 'ready'
    if (!(await isConfigured())) return 'needs-connect'
    return (await hasSpotifyAccess()) && (await isSignedIn()) ? 'ready' : 'needs-connect'
  })

  const phase: Phase = override ?? resolved ?? 'checking'

  const connect = useCallback(() => {
    window.open(guideUrl('spotify'), '_blank', 'noopener,noreferrer')
  }, [])

  // Setup finishes in that other tab, so this one waits for the stored ID to
  // appear rather than leaving a stale "Connect" button behind.
  useEffect(() => {
    if (!isExtension()) return
    return subscribeClientId(async (value) => {
      if (!value) return setOverride('needs-connect')
      if ((await hasSpotifyAccess()) && (await isSignedIn())) setOverride('ready')
    })
  }, [])

  const disconnect = useCallback(async () => {
    await signOut()
    setOverride('needs-connect')
  }, [])

  return (
    <div className="spotify" data-size={sizeName}>
      <header className="spotify__head">
        <span className="spotify__brand">
          <span className="spotify__badge">
            <SpotifyMark />
          </span>
          Spotify
        </span>
        {phase === 'ready' && isExtension() ? (
          <button
            className="spotify__signout is-icon-btn"
            onClick={() => void disconnect()}
            title="Disconnect Spotify"
            aria-label="Disconnect Spotify"
          >
            <Icon name="open" />
          </button>
        ) : null}
      </header>

      {phase === 'checking' ? (
        <div className="spotify__body spotify__body--center">
          <Icon name="spinner" spin />
        </div>
      ) : phase === 'needs-connect' ? (
        <div className="spotify__body spotify__body--center">
          <button className="spotify__connect" onClick={connect}>
            <Icon name="link" /> Connect Spotify
          </button>
        </div>
      ) : (
        <NowPlaying
          sizeName={sizeName}
          showArt={config.showArt}
          fillArt={config.fillArt}
          onSignedOut={() => setOverride('needs-connect')}
        />
      )}
    </div>
  )
}

// Kept local rather than in `@/core/icons`, which is Font Awesome only.
function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

registerWidget<SpotifyConfig>({
  type: 'spotify',
  name: 'Spotify',
  description: 'What is playing now, with controls for whichever device is playing it.',
  icon: 'play',
  configSchema: SpotifyConfig,
  sizes: ['medium', 'large', 'wide'],
  defaultSize: 'medium',
  origins: [...SPOTIFY_ORIGINS, ART_ORIGIN],
  Component: SpotifyWidget,
  fields: [
    { path: 'showArt', label: 'Show album art', control: { kind: 'toggle' } },
    { path: 'fillArt', label: 'Fill behind art', control: { kind: 'toggle' } },
  ],
})

export { SPOTIFY_PERMISSIONS }
