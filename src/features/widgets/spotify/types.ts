// The vocabulary the widget renders from. Every reading comes from the
// documented Web API and is normalised at the edge, so the UI never sees a raw
// Spotify payload.

export interface Track {
  id: string | null
  title: string
  artists: string
  album: string
  /** Largest available cover, or null when Spotify sends none. */
  artUrl: string | null
  /** Opens the track in the app or the web player. */
  url: string | null
}

export interface Device {
  id: string | null
  name: string
  /** The one Spotify considers current; the default target for a resume. */
  isActive: boolean
}

export interface Playback {
  track: Track | null
  isPlaying: boolean
  progressMs: number
  durationMs: number
  /** The device currently holding the session, e.g. "Phone" or "MacBook Pro". */
  deviceName: string | null
  /** False for free accounts, which the transport controls are disabled for. */
  canControl: boolean
  /**
   * True when the track is the last one played rather than a live reading, so
   * the tile can say so instead of looking like it is playing.
   */
  isStale: boolean
}

export type Command = 'play' | 'pause' | 'next' | 'previous'

/** Cross-axis placement of the art and text, as flexbox values. */
