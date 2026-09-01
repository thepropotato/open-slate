/**
 * The Spotify application this extension authenticates as.
 *
 * A client ID is an identifier, not a credential: it is public by design and
 * appears in the redirect URL of every OAuth app on the web. There is no client
 * secret here and there must never be one — an extension is a zip a user can
 * unpack, so a shipped secret is a published secret. Authorisation Code with
 * PKCE exists exactly so a public client can authenticate without one.
 *
 * What keeps the ID safe to publish is the redirect allowlist in the Spotify
 * dashboard: tokens are only ever returned to a URI registered there, so the ID
 * alone gets an attacker nothing.
 *
 * To set this up:
 *   1. Put the app's client ID below.
 *   2. Register both redirect URIs in the dashboard. Chrome derives them from
 *      the extension id, which differs between the store build and an unpacked
 *      one, and Spotify matches them character for character:
 *        https://kbacclgoobafnkifgckaenacaeghfonm.chromiumapp.org/  (store)
 *        https://pekieblifbcpnelnepeamdmkbiggkglp.chromiumapp.org/  (unpacked)
 *      An unpacked id is derived from the folder path, so it is local to one
 *      machine and another contributor's will differ; `redirectUri()` prints
 *      whichever the running build is using.
 */

export const CLIENT_ID = '9590d1ec82c746eb96462a834ae46988'

export const SPOTIFY_ORIGINS = ['https://api.spotify.com/*', 'https://accounts.spotify.com/*']

// Cover art is served from Spotify's CDN, a different origin to the API.
export const ART_ORIGIN = 'https://i.scdn.co/*'

/**
 * Scopes are requested as one set, so the consent screen appears once.
 * `user-read-currently-playing` is what the widget needs to read; the
 * `modify-playback-state` scope is what lets it drive a device that is not this
 * browser — the reason this widget uses the Web API at all.
 */
export const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  // Lets the widget show the last track when nothing is playing, rather than
  // an empty tile.
  'user-read-recently-played',
] as const

export const isConfigured = (): boolean => CLIENT_ID.length > 0
