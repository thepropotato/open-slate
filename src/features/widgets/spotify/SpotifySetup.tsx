import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/core/icons'
import { isExtension } from '@/core/platform/browser'
import { requestSpotifyAccess } from './api'
import { redirectUri, signIn } from './auth'
import { isValidClientId, readClientId, writeClientId } from './config'
import { registerGuide } from '@/features/setup/registry'

/**
 * Walks a user through registering their own Spotify app.
 *
 * Spotify's development mode allows 25 manually allowlisted users per app and
 * quota extension is organisations-only, so the extension cannot ship one ID for
 * everyone. Each user creates an app they own; this page exists so that is a
 * guided five minutes rather than a docs hunt.
 */
function SpotifySetup() {
  const [clientId, setClientId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  // Chrome derives the redirect from the extension ID, so it differs between the
  // store build and an unpacked one. It has to be read at runtime and shown.
  const redirect = isExtension() ? redirectUri() : 'Load the extension to see this.'

  // Re-editing an existing ID is the common repair path when the first attempt
  // was pasted wrong, so the stored one is prefilled.
  useEffect(() => {
    void readClientId().then((stored) => {
      if (stored) setClientId(stored)
    })
  }, [])

  const copyRedirect = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(redirect)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy. Select the URL and copy it manually.')
    }
  }, [redirect])

  const connect = useCallback(async () => {
    setError(null)
    const trimmed = clientId.trim().toLowerCase()

    // Checked before the consent window opens: a malformed ID would otherwise
    // fail inside Spotify's own page, where the reason is far less clear.
    if (!isValidClientId(trimmed)) {
      setError('That does not look like a client ID. It is 32 letters and numbers.')
      return
    }

    setBusy(true)
    try {
      // Stored first: `signIn` reads the ID back out of storage.
      await writeClientId(trimmed)
      if (!(await requestSpotifyAccess())) {
        setError('Open Slate needs access to Spotify to continue.')
        return
      }
      await signIn()
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to Spotify.')
    } finally {
      setBusy(false)
    }
  }, [clientId])

  if (done) {
    return (
      <div className="setup__pane setup--done">
        <div className="setup__check">
          <Icon name="check" />
        </div>
        <h1>Spotify is connected</h1>
        <p className="setup__lede">
          The widget is live on your new tab. You will not need to do this again.
        </p>
        <button className="setup__cta" onClick={() => window.location.assign('/newtab.html')}>
          Open new tab
        </button>
      </div>
    )
  }

  return (
    <>
      <header className="setup__head">
        <div className="setup__title">
          <span className="setup__badge">
            <SpotifyMark />
          </span>
          <h1>Connect Spotify</h1>
        </div>
        <p className="setup__lede">
          Spotify only hands out playback access to apps registered by their owner, so this
          one is yours. It is created under your account and used only by this browser. It
          takes about two minutes and is a one-time thing.
        </p>
      </header>

      <ol className="setup__steps">
        <li className="setup__step">
          <h2>Open the Spotify developer dashboard</h2>
          <p>Sign in with the same Spotify account you listen on.</p>
          <a
            className="setup__link"
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            developer.spotify.com/dashboard <Icon name="external" />
          </a>
        </li>

        <li className="setup__step">
          <h2>Create an app</h2>
          <p>
            Click <strong>Create app</strong>. The name and description are only ever shown to
            you, so <em>Open Slate</em> does fine. Leave the website field blank.
          </p>
        </li>

        <li className="setup__step">
          <h2>Add this redirect URI</h2>
          <p>
            Paste this into <strong>Redirect URIs</strong> and press Add. Spotify matches it
            character for character, so copy it rather than typing it.
          </p>
          <div className="setup__copy">
            <code className="setup__uri">{redirect}</code>
            <button
              className="setup__copybtn"
              onClick={() => void copyRedirect()}
              disabled={!isExtension()}
            >
              <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="setup__hint">
            This URL is unique to your install of Open Slate.
          </p>
        </li>

        <li className="setup__step">
          <h2>Tick Web API, then save</h2>
          <p>
            Under <strong>Which API/SDKs are you planning to use?</strong> tick{' '}
            <strong>Web API</strong>. Agree to the terms and click Save.
          </p>
        </li>

        <li className="setup__step">
          <h2>Copy your Client ID</h2>
          <p>
            Open the app's <strong>Settings</strong>. Copy the <strong>Client ID</strong> and
            paste it below.
          </p>
          <p className="setup__hint">
            Leave the client secret where it is. This extension uses PKCE and never asks for
            one, so anything that does is not Open Slate.
          </p>
          <input
            className="setup__input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 4f9c2a7b1e0d4c8fa3b6e5d2c1908f7a"
            spellCheck={false}
            autoComplete="off"
            aria-label="Spotify client ID"
          />
        </li>
      </ol>

      {error ? <p className="setup__error">{error}</p> : null}

      <button
        className="setup__cta"
        onClick={() => void connect()}
        disabled={busy || !isExtension()}
      >
        {busy ? <Icon name="spinner" spin /> : <Icon name="link" />}
        {busy ? 'Connecting…' : 'Connect Spotify'}
      </button>

      <p className="setup__hint setup__hint--foot">
        Your client ID stays on this device. Open Slate has no server and sends it nowhere
        except Spotify.
      </p>
    </>
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

registerGuide({
  id: 'spotify',
  title: 'Spotify',
  summary: 'Now playing, with controls for whichever device is playing it.',
  icon: 'play',
  Component: SpotifySetup,
})
