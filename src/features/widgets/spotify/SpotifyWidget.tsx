import { useCallback, useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { isExtension } from '@/core/platform/browser'
import { hasSpotifyAccess, requestSpotifyAccess, SPOTIFY_PERMISSIONS } from './api'
import { isSignedIn, signIn, signOut } from './auth'
import { ART_ORIGIN, isConfigured, SPOTIFY_ORIGINS } from './config'
import { NowPlaying } from './NowPlaying'
import './spotify.css'

const SpotifyConfig = z.object({
  showArt: z.boolean().default(true),
  fillArt: z.boolean().default(true),
})
type SpotifyConfig = z.infer<typeof SpotifyConfig>

// Connecting is two gates: the host permission, then Spotify's own consent. They
// are requested one after the other from a single button, so it reads as one step.
type Phase = 'checking' | 'unconfigured' | 'needs-connect' | 'ready'

function SpotifyWidget({ config, sizeName }: WidgetProps<SpotifyConfig>) {
  // `null` until the gates have been checked; set directly once connecting or
  // signing out has moved the widget on from whatever was resolved.
  const [override, setOverride] = useState<Phase | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resolved = useAsyncValue<Phase>('spotify-phase', async () => {
    // Outside the extension the dev stub renders, so neither gate applies and a
    // missing client ID does not matter — there is nothing to sign in to.
    if (!isExtension()) return 'ready'
    if (!isConfigured()) return 'unconfigured'
    return (await hasSpotifyAccess()) && (await isSignedIn()) ? 'ready' : 'needs-connect'
  })

  const phase: Phase = override ?? resolved ?? 'checking'

  const connect = useCallback(async () => {
    setError(null)
    try {
      if (!(await requestSpotifyAccess())) return
      await signIn()
      setOverride('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to Spotify.')
    }
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
      ) : phase === 'unconfigured' ? (
        <div className="spotify__body spotify__body--center">
          <p className="spotify__note">
            This build has no Spotify client ID set. See <code>spotify/config.ts</code>.
          </p>
        </div>
      ) : phase === 'needs-connect' ? (
        <div className="spotify__body spotify__body--center">
          {error ? <p className="spotify__note spotify__note--error">{error}</p> : null}
          <button className="spotify__connect" onClick={() => void connect()}>
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
