/**
 * Authorisation Code with PKCE, against Spotify's documented endpoints.
 *
 * PKCE replaces the client secret with a per-sign-in proof: a random verifier is
 * hashed into a challenge, the challenge goes out with the authorise request,
 * and the verifier is only revealed when the code is redeemed. An intercepted
 * code is useless without the verifier, which never leaves this browser - so
 * there is no secret to ship. See `config.ts`.
 */

import { isExtension, localStore } from '@/core/platform/browser'
import { readClientId, SCOPES } from './config'

const AUTHORIZE = 'https://accounts.spotify.com/authorize'
const TOKEN = 'https://accounts.spotify.com/api/token'
const TOKEN_KEY = 'spotify:tokens'

interface Tokens {
  accessToken: string
  refreshToken: string
  /** Epoch ms. Treated as expired slightly early, so a call never races the clock. */
  expiresAt: number
}

const EXPIRY_MARGIN_MS = 60_000

const readTokens = (): Promise<Tokens | undefined> => localStore.get<Tokens>(TOKEN_KEY)
const writeTokens = (tokens: Tokens): Promise<void> => localStore.set(TOKEN_KEY, tokens)

export const signOut = (): Promise<void> => localStore.remove(TOKEN_KEY)

export const isSignedIn = async (): Promise<boolean> => (await readTokens()) !== undefined

/** Chrome derives this from the extension ID; it must be registered in the dashboard verbatim. */
export function redirectUri(): string {
  if (!isExtension()) return `${location.origin}/newtab.html`
  return chrome.identity.getRedirectURL()
}

const randomVerifier = (): string => {
  // 96 bytes of base64url lands inside the 43–128 character range the spec allows.
  const bytes = crypto.getRandomValues(new Uint8Array(96))
  return base64url(bytes)
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/**
 * Runs the consent flow. Chrome owns the window and hands back the redirect, so
 * the extension never sees the user's Spotify credentials.
 */
export async function signIn(): Promise<void> {
  if (!isExtension()) throw new Error('Signing in needs the extension.')

  const clientId = await readClientId()
  if (!clientId) throw new Error('No Spotify client ID is set up yet.')

  const verifier = randomVerifier()
  // Guards against a redirect that wasn't the one we started.
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)))

  const authorize = new URL(AUTHORIZE)
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    scope: SCOPES.join(' '),
    state,
  }).toString()

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: authorize.toString(),
    interactive: true,
  })
  if (!redirect) throw new Error('Sign-in was cancelled.')

  const params = new URL(redirect).searchParams
  const error = params.get('error')
  if (error) throw new Error(error === 'access_denied' ? 'Sign-in was declined.' : error)
  if (params.get('state') !== state) throw new Error('Sign-in could not be verified.')

  const code = params.get('code')
  if (!code) throw new Error('Spotify returned no authorisation code.')

  await redeem(
    new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  )
}

/**
 * Exchanges a grant for tokens and stores the result.
 *
 * Spotify's PKCE refresh tokens are single-use and rotate on every refresh, so
 * the new one is written back each time. Keeping the old one would sign the user
 * out an hour later.
 */
async function redeem(body: URLSearchParams, previousRefresh?: string): Promise<Tokens> {
  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error_description?: string
    error?: string
  } | null

  if (!response.ok || !payload?.access_token) {
    const reason = payload?.error_description ?? payload?.error ?? `Responded ${response.status}`
    throw new Error(reason)
  }

  const tokens: Tokens = {
    accessToken: payload.access_token,
    // A refresh response may omit the refresh token, meaning "keep using it".
    refreshToken: payload.refresh_token ?? previousRefresh ?? '',
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  await writeTokens(tokens)
  return tokens
}

/** Thrown when the stored grant is gone; the UI shows the connect prompt again. */
export class SignedOutError extends Error {
  constructor(message = 'Spotify needs connecting again.') {
    super(message)
    this.name = 'SignedOutError'
  }
}

/** A valid access token, refreshing first when the stored one is close to expiry. */
export async function accessToken(): Promise<string> {
  const tokens = await readTokens()
  if (!tokens) throw new SignedOutError('Not connected to Spotify.')
  if (Date.now() < tokens.expiresAt - EXPIRY_MARGIN_MS) return tokens.accessToken

  if (!tokens.refreshToken) {
    await signOut()
    throw new SignedOutError()
  }

  const clientId = await readClientId()
  // The ID was cleared out from under the tokens; they can no longer be refreshed.
  if (!clientId) {
    await signOut()
    throw new SignedOutError()
  }

  try {
    const refreshed = await redeem(
      new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }),
      tokens.refreshToken,
    )
    return refreshed.accessToken
  } catch {
    // A rejected refresh token is spent or revoked: clear it rather than
    // retrying a grant that cannot recover.
    await signOut()
    throw new SignedOutError()
  }
}
