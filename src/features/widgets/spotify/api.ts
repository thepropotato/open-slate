import { z } from 'zod'
import { isExtension, permissions } from '@/core/platform/browser'
import { accessToken, SignedOutError } from './auth'
import { ART_ORIGIN, SPOTIFY_ORIGINS } from './config'
import type { Command, Device, Playback, Track } from './types'

const API = 'https://api.spotify.com/v1'

// Only the fields the widget reads are described, so an unrelated addition to
// Spotify's payload never invalidates a response we could have rendered.
const ImageSchema = z.object({ url: z.string(), width: z.number().nullable().optional() })

const ItemSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().optional(),
  duration_ms: z.number().optional(),
  artists: z.array(z.object({ name: z.string() })).optional(),
  album: z.object({ name: z.string().optional(), images: z.array(ImageSchema).optional() }).optional(),
  external_urls: z.object({ spotify: z.string() }).optional(),
})

const RecentSchema = z.object({
  items: z.array(z.object({ track: ItemSchema.nullable().optional() })).optional(),
})

const DevicesSchema = z.object({
  devices: z
    .array(
      z.object({
        id: z.string().nullable().optional(),
        name: z.string().optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .optional(),
})

const PlaybackSchema = z.object({
  is_playing: z.boolean().optional(),
  progress_ms: z.number().nullable().optional(),
  item: ItemSchema.nullable().optional(),
  device: z.object({ name: z.string().optional() }).nullable().optional(),
})

export const SPOTIFY_PERMISSIONS = [...SPOTIFY_ORIGINS, ART_ORIGIN]

export const hasSpotifyAccess = (): Promise<boolean> => permissions.has([], SPOTIFY_PERMISSIONS)

export const requestSpotifyAccess = (): Promise<boolean> =>
  permissions.request([], SPOTIFY_PERMISSIONS)

async function call(path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken()
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
}

function toTrack(item: z.infer<typeof ItemSchema>): Track {
  // Widest image first; Spotify orders them largest-first but does not promise to.
  const art = [...(item.album?.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  return {
    id: item.id ?? null,
    title: item.name ?? 'Unknown track',
    artists: (item.artists ?? []).map((a) => a.name).join(', '),
    album: item.album?.name ?? '',
    artUrl: art?.url ?? null,
    url: item.external_urls?.spotify ?? null,
  }
}

/**
 * The current playback state, or null when nothing is playing.
 *
 * Spotify answers 204 with an empty body when the account has no active device —
 * a normal state, not an error, so it reads back as "nothing playing" rather
 * than throwing.
 */
export async function fetchPlayback(): Promise<Playback | null> {
  if (!isExtension()) return devStub()

  const response = await call('/me/player')
  // 204 with an empty body means no active device: normal, not an error. The
  // last played track is better than an empty tile, so fall back to it.
  if (response.status === 204) return lastPlayed()
  if (response.status === 401) throw new SignedOutError()
  if (response.status === 429) throw new Error('Spotify is rate limiting; try again shortly.')
  if (!response.ok) throw new Error(`Spotify responded ${response.status}.`)

  const parsed = PlaybackSchema.safeParse(await response.json().catch(() => null))
  // A shape we cannot read is reported as such, never rendered as a wrong number.
  if (!parsed.success) throw new Error('Spotify returned an unexpected shape.')

  const state = parsed.data
  if (!state.item) return lastPlayed()

  return {
    track: toTrack(state.item),
    isPlaying: state.is_playing ?? false,
    progressMs: state.progress_ms ?? 0,
    durationMs: state.item.duration_ms ?? 0,
    deviceName: state.device?.name ?? null,
    canControl: true,
    isStale: false,
  }
}

/**
 * The most recently played track, shown when nothing is playing. It carries no
 * progress or device, and is flagged stale so the tile says "Last played"
 * rather than pretending to be live.
 */
async function lastPlayed(): Promise<Playback | null> {
  const response = await call('/me/player/recently-played?limit=1')
  if (!response.ok) return null

  const parsed = RecentSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) return null

  const track = parsed.data.items?.[0]?.track
  if (!track) return null

  return {
    track: toTrack(track),
    isPlaying: false,
    progressMs: 0,
    durationMs: track.duration_ms ?? 0,
    deviceName: null,
    canControl: true,
    isStale: true,
  }
}

/**
 * The devices Spotify can currently reach. An app that is fully quit does not
 * appear, so this can be empty even when the user has devices.
 */
export async function fetchDevices(): Promise<Device[]> {
  if (!isExtension()) return [{ id: 'stub', name: 'MacBook Pro', isActive: false }]

  const response = await call('/me/player/devices')
  if (!response.ok) return []

  const parsed = DevicesSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) return []

  return (parsed.data.devices ?? []).map((d) => ({
    id: d.id ?? null,
    name: d.name ?? 'Unknown device',
    isActive: d.is_active ?? false,
  }))
}

/**
 * Moves the session onto `deviceId` and starts it playing. Used to resume when
 * nothing is active, which a bare play call cannot do — it needs a device to
 * act on.
 */
export async function transferTo(deviceId: string): Promise<void> {
  if (!isExtension()) return

  const token = await accessToken()
  const response = await fetch(`${API}/me/player`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })

  if (response.ok || response.status === 202) return
  if (response.status === 401) throw new SignedOutError()
  if (response.status === 403) throw new Error('Starting playback needs Spotify Premium.')
  throw new Error(`Spotify responded ${response.status}.`)
}

const ENDPOINTS: Record<Command, { path: string; method: string }> = {
  play: { path: '/me/player/play', method: 'PUT' },
  pause: { path: '/me/player/pause', method: 'PUT' },
  next: { path: '/me/player/next', method: 'POST' },
  previous: { path: '/me/player/previous', method: 'POST' },
}

/** Raised when a play had no device to act on, so the UI can offer the list. */
export class NoDeviceError extends Error {
  constructor(readonly devices: Device[]) {
    super('No active Spotify device.')
    this.name = 'NoDeviceError'
  }
}

/**
 * Drives whichever device currently holds the account's session — the desktop
 * app or a phone, not just a browser tab.
 *
 * A play with nothing active answers 404. Rather than surfacing that, the last
 * active device is woken; if Spotify can reach none, `NoDeviceError` carries
 * the list so the caller can ask.
 */
export async function sendCommand(command: Command): Promise<void> {
  if (!isExtension()) {
    // Lets the picker and the no-device message be reviewed under `vite dev`.
    const variant =
      typeof localStorage === 'undefined' ? null : localStorage.getItem('spotify:shot-variant')
    if (command === 'play' && variant === 'devices') {
      throw new NoDeviceError([
        { id: 'a', name: 'MacBook Pro', isActive: false },
        { id: 'b', name: 'iPhone', isActive: false },
        { id: 'c', name: 'Kitchen speaker', isActive: false },
      ])
    }
    if (command === 'play' && variant === 'nodevice') throw new NoDeviceError([])
    return
  }

  const { path, method } = ENDPOINTS[command]
  const response = await call(path, { method })

  // 204 is the documented success; 202 means the device is waking.
  if (response.ok || response.status === 202) return
  if (response.status === 401) throw new SignedOutError()
  if (response.status === 403) throw new Error('Controlling playback needs Spotify Premium.')
  if (response.status === 404) {
    if (command !== 'play') throw new Error('No active Spotify device to control.')
    return resume()
  }
  throw new Error(`Spotify responded ${response.status}.`)
}

/** Starts playback on the last active device, or asks when there is no obvious one. */
async function resume(): Promise<void> {
  const devices = await fetchDevices()
  // Spotify keeps flagging the last device active for a while after it idles,
  // which is exactly the "resume where I left off" target.
  const target = devices.find((d) => d.isActive) ?? (devices.length === 1 ? devices[0] : null)
  if (!target?.id) throw new NoDeviceError(devices)
  await transferTo(target.id)
}

/**
 * Dev stub so the widget renders under `vite dev`, with no extension and no
 * account. `spotify:shot-variant` in localStorage forces one of the states that
 * only occurs against a real account, so they can be reviewed visually.
 */
// Real cover art from Spotify's CDN, so the dev stub exercises the real <img>
// path and the CORS-dependent colour sampling behind it.
const STUB_ART = 'https://i.scdn.co/image/ab67616d0000b273ff9ca10b55ce82ae553c8228'

function devStub(): Playback {
  const variant =
    typeof localStorage === 'undefined' ? null : localStorage.getItem('spotify:shot-variant')

  if (variant === 'stale' || variant === 'devices' || variant === 'nodevice') {
    return {
      track: {
        id: 'stub',
        title: 'Weightless',
        artists: 'Marconi Union',
        album: 'Ambient Transmissions Vol. 2',
        artUrl: null,
        url: null,
      },
      isPlaying: false,
      progressMs: 0,
      durationMs: 480_000,
      deviceName: null,
      canControl: true,
      isStale: true,
    }
  }

  return {
    track: {
      id: 'stub',
      title: 'Weightless',
      artists: 'Marconi Union',
      album: 'Ambient Transmissions Vol. 2',
      artUrl: STUB_ART,
      url: null,
    },
    isPlaying: true,
    // Drifts with the clock so the scrubber visibly moves while styling it.
    progressMs: (Date.now() / 10) % 480_000,
    durationMs: 480_000,
    deviceName: 'MacBook Pro',
    canControl: true,
    isStale: false,
  }
}
