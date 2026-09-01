import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { SignedOutError } from './auth'
import { fetchPlayback, NoDeviceError, sendCommand, transferTo } from './api'
import { dominantColor } from './dominant'
import type { Command, Device, Playback } from './types'
import type { WidgetSizeName } from '@/core/widgets/types'

// How often the playback state is re-read. Polling only ever runs while the tab
// is visible, so a new tab left open in the background costs nothing.
const POLL_MS = 10_000

interface State {
  playback: Playback | null
  error: string | null
  loading: boolean
}

export function NowPlaying({
  sizeName,
  showArt,
  fillArt,
  onSignedOut,
}: {
  sizeName: WidgetSizeName
  showArt: boolean
  fillArt: boolean
  onSignedOut: () => void
}) {
  const [state, setState] = useState<State>({ playback: null, error: null, loading: true })
  const [busy, setBusy] = useState(false)
  // Set only when a play found nothing to play on, so the picker is never in
  // the way of the ordinary case.
  const [choosing, setChoosing] = useState<Device[] | null>(null)
  // Progress is interpolated between polls, so the scrubber moves smoothly
  // without asking Spotify every second. Reset whenever a poll lands.
  const [drift, setDrift] = useState(0)
  const anchor = useRef(Date.now())

  const load = useCallback(async () => {
    try {
      const playback = await fetchPlayback()
      anchor.current = Date.now()
      setDrift(0)
      setState({ playback, error: null, loading: false })
    } catch (error) {
      if (error instanceof SignedOutError) {
        onSignedOut()
        return
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not reach Spotify.',
      }))
    }
  }, [onSignedOut])

  // Poll only while the tab is on screen; a hidden new tab does no work.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (timer !== undefined) return
      void load()
      timer = setInterval(() => void load(), POLL_MS)
    }
    const stop = () => {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())

    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  // Ticks the scrubber forward between polls, only while something is playing.
  useEffect(() => {
    if (!state.playback?.isPlaying) return
    const timer = setInterval(() => setDrift(Date.now() - anchor.current), 1000)
    return () => clearInterval(timer)
  }, [state.playback?.isPlaying, state.playback?.track?.id])

  const run = useCallback(
    async (command: Command) => {
      setBusy(true)
      try {
        await sendCommand(command)
        // Spotify needs a moment to settle before it reports the new state.
        await new Promise((resolve) => setTimeout(resolve, 350))
        await load()
      } catch (error) {
        if (error instanceof SignedOutError) {
          onSignedOut()
          return
        }
        if (error instanceof NoDeviceError) {
          setChoosing(error.devices)
          return
        }
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'That did not work.',
        }))
      } finally {
        setBusy(false)
      }
    },
    [load, onSignedOut],
  )

  const playOn = useCallback(
    async (device: Device) => {
      if (!device.id) return
      setBusy(true)
      setChoosing(null)
      try {
        await transferTo(device.id)
        await new Promise((resolve) => setTimeout(resolve, 600))
        await load()
      } catch (error) {
        if (error instanceof SignedOutError) {
          onSignedOut()
          return
        }
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'That did not work.',
        }))
      } finally {
        setBusy(false)
      }
    },
    [load, onSignedOut],
  )

  if (state.loading) {
    return (
      <div className="spotify__body spotify__body--center">
        <Icon name="spinner" spin />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="spotify__body spotify__body--center">
        <p className="spotify__note">{state.error}</p>
        <button className="spotify__retry" onClick={() => void load()}>
          <Icon name="reset" /> Try again
        </button>
      </div>
    )
  }

  const { playback } = state
  if (!playback?.track) {
    return (
      <div className="spotify__body spotify__body--center">
        <p className="spotify__note">Nothing playing.</p>
      </div>
    )
  }

  if (choosing) {
    return (
      <div className="spotify__body spotify__body--center">
        {choosing.length === 0 ? (
          <>
            <p className="spotify__note">
              No Spotify device is reachable. Open Spotify on a phone or computer, then press play.
            </p>
            <button className="spotify__retry" onClick={() => setChoosing(null)}>
              Back
            </button>
          </>
        ) : (
          <>
            <p className="spotify__note">Play on</p>
            <div className="spotify__devices">
              {choosing.map((device) => (
                <button
                  key={device.id ?? device.name}
                  className="spotify__device-pick"
                  onClick={() => void playOn(device)}
                  disabled={!device.id}
                >
                  {device.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const { track } = playback
  const elapsed = Math.min(playback.progressMs + drift, playback.durationMs)
  // A stale track has no position to show, so the bar sits empty rather than
  // implying the track is part-way through.
  const pct = playback.isStale || playback.durationMs === 0 ? 0 : (elapsed / playback.durationMs) * 100

  return (
    <div className="spotify__body" data-size={sizeName}>
      {showArt ? <Cover url={track.artUrl} fill={fillArt} /> : null}

      <div className="spotify__meta">
        {track.url ? (
          <a className="spotify__title" href={track.url} target="_blank" rel="noopener noreferrer">
            {track.title}
          </a>
        ) : (
          <span className="spotify__title">{track.title}</span>
        )}
        <span className="spotify__artist">{track.artists}</span>
      </div>

      <div className="spotify__track" role="presentation">
        <div className="spotify__fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="spotify__foot">
        <span className="spotify__time">
          {playback.isStale ? (
            'Last played'
          ) : (
            <>
              {clock(elapsed)}
              <span className="spotify__of"> / {clock(playback.durationMs)}</span>
            </>
          )}
        </span>
        <div className="spotify__controls">
          <button
            className="is-icon-btn"
            onClick={() => void run('previous')}
            disabled={busy}
            title="Previous"
            aria-label="Previous track"
          >
            <Icon name="previousTrack" />
          </button>
          <button
            className="is-icon-btn spotify__toggle"
            onClick={() => void run(playback.isPlaying ? 'pause' : 'play')}
            disabled={busy}
            title={playback.isPlaying ? 'Pause' : 'Play'}
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={playback.isPlaying ? 'pause' : 'play'} />
          </button>
          <button
            className="is-icon-btn"
            onClick={() => void run('next')}
            disabled={busy}
            title="Next"
            aria-label="Next track"
          >
            <Icon name="nextTrack" />
          </button>
        </div>
        {/* The device is the point of the API path: it may not be this browser. */}
        <span className="spotify__device">{playback.deviceName ?? ''}</span>
      </div>
    </div>
  )
}

/*
 * The art, on a stage that spans the tile's width. Where a square cannot also be
 * full-width, `fill` paints the leftover band either side in the art's own
 * dominant colour, so the block reads as one piece rather than a square floating
 * on the tile.
 */
function Cover({ url, fill }: { url: string | null; fill: boolean }) {
  // Keyed by the art it was sampled from, so the colour of a previous track is
  // never painted behind the current one while the new sample is in flight.
  const [sampled, setSampled] = useState<{ url: string; color: string | null }>()

  useEffect(() => {
    if (!fill || !url) return
    let live = true
    void dominantColor(url).then((color) => {
      if (live) setSampled({ url, color })
    })
    return () => {
      live = false
    }
  }, [url, fill])

  const backdrop = fill && sampled?.url === url ? sampled.color : null

  return (
    <div
      className="spotify__stage"
      data-fill={backdrop !== null ? 'true' : 'false'}
      style={backdrop ? { background: backdrop } : undefined}
    >
      {url ? (
        <img className="spotify__art" src={url} alt="" loading="lazy" />
      ) : (
        <div className="spotify__art spotify__art--empty">
          <Icon name="play" />
        </div>
      )}
    </div>
  )
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
