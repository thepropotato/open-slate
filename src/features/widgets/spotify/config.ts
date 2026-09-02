/**
 * The Spotify application this extension authenticates as.
 *
 * There is no shipped client ID. Spotify's development mode caps an app at 25
 * manually allowlisted users, and quota extension - the tier that lifts that -
 * is only granted to organisations, so a single ID baked into the build could
 * never serve the store audience. Each user registers their own app instead;
 * `setup.html` walks them through it.
 *
 * A client ID is an identifier, not a credential: it is public by design and
 * appears in the redirect URL of every OAuth app on the web. There is no client
 * secret here and there must never be one - an extension is a zip a user can
 * unpack, so a shipped secret is a published secret. Authorisation Code with
 * PKCE exists exactly so a public client can authenticate without one.
 *
 * What keeps a user's ID safe is the redirect allowlist in their own dashboard:
 * tokens are only ever returned to a URI registered there.
 */

import { localStore } from '@/core/platform/browser'

const CLIENT_ID_KEY = 'spotify:client-id'

export const SPOTIFY_ORIGINS = ['https://api.spotify.com/*', 'https://accounts.spotify.com/*']

// Cover art is served from Spotify's CDN, a different origin to the API.
export const ART_ORIGIN = 'https://i.scdn.co/*'

/**
 * Scopes are requested as one set, so the consent screen appears once.
 * `user-read-currently-playing` is what the widget needs to read; the
 * `modify-playback-state` scope is what lets it drive a device that is not this
 * browser - the reason this widget uses the Web API at all.
 */
export const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  // Lets the widget show the last track when nothing is playing, rather than
  // an empty tile.
  'user-read-recently-played',
] as const

/** Spotify client IDs are 32 lowercase hex characters. */
const CLIENT_ID_PATTERN = /^[0-9a-f]{32}$/

export const isValidClientId = (value: string): boolean =>
  CLIENT_ID_PATTERN.test(value.trim().toLowerCase())

export const readClientId = async (): Promise<string | undefined> =>
  localStore.get<string>(CLIENT_ID_KEY)

export const writeClientId = (value: string): Promise<void> =>
  localStore.set(CLIENT_ID_KEY, value.trim().toLowerCase())

export const clearClientId = (): Promise<void> => localStore.remove(CLIENT_ID_KEY)

export const isConfigured = async (): Promise<boolean> => {
  const id = await readClientId()
  return id !== undefined && id.length > 0
}

/** Notifies open tabs when setup completes in another one. */
export const subscribeClientId = (fn: (value: unknown) => void): (() => void) =>
  localStore.subscribe(CLIENT_ID_KEY, fn)
