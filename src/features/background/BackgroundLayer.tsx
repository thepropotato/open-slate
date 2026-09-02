import { useEffect, useRef } from 'react'
import { useSettings } from '@/core/settings/SettingsProvider'
import { accentStore } from '@/core/theme/accentStore'
import { usePalette } from '@/core/theme/ThemeProvider'
import { dominantColor, dominantColorOf, isDark, mix } from '@/core/theme/color'
import { useBackgroundSource } from './useBackgroundSource'
import './background.css'

/**
 * Paints the wallpaper - colour, gradient, image, video or slideshow - plus its
 * adjustment layers. Decoding stops while the tab is hidden, and nothing
 * animates under reduced motion.
 */
export function BackgroundLayer() {
  const { background, appearance } = useSettings()
  const palette = usePalette()
  const source = useBackgroundSource(background)

  // Blur bleeds the page colour in at the edges, so scale rises with it.
  const scale = background.scale + background.blur / 220

  const style = {
    filter: `blur(${background.blur}px) saturate(${background.saturation}) brightness(${background.brightness})`,
    // A variable, not `transform`: the Ken Burns keyframes build on it.
    ['--bg-scale' as string]: String(scale),
  } satisfies React.CSSProperties

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__base" style={{ background: baseFill(background, palette) }} />

      {source.kind === 'image' ? (
        <ImageLayer
          src={source.src}
          style={style}
          fit={background.fit}
          position={background.position}
          kenBurns={background.kenBurns}
          crossfade={background.type === 'slideshow' && background.slideshow.crossfade}
          sampleAccent={appearance.accentSource === 'wallpaper'}
        />
      ) : null}

      {source.kind === 'video' ? (
        <VideoLayer
          src={source.src}
          style={style}
          fit={background.fit}
          settings={background.video}
          sampleAccent={appearance.accentSource === 'wallpaper'}
        />
      ) : null}

      {/* Dim and vignette rescue text over a photo; over a solid or gradient
          they would only mute a colour the palette chose. */}
      {source.kind !== 'none' ? (
        <>
          <div className="bg__dim" style={{ opacity: background.dim }} />
          <div className="bg__vignette" style={{ opacity: background.vignette }} />
        </>
      ) : null}
    </div>
  )
}

function baseFill(
  background: ReturnType<typeof useSettings>['background'],
  palette: ReturnType<typeof usePalette>,
): string {
  const themed = background.followTheme
  if (background.type === 'gradient') {
    const { angle } = background.gradient
    // Always lifted -> deepened, in both light and dark: brightening towards the
    // edge reads as flat and washed out.
    const from = themed ? mix(palette.bg, palette.bgElevated, 0.75) : background.gradient.from
    const to = themed
      ? mix(palette.bg, '#000000', isDark(palette.bg) ? 0.5 : 0.09)
      : background.gradient.to
    return `linear-gradient(${angle}deg, ${from}, ${to})`
  }
  // Solid also sits behind media as the letterbox colour and the pre-load fill.
  return themed ? palette.bg : background.color
}

function ImageLayer({
  src,
  style,
  fit,
  position,
  kenBurns,
  crossfade,
  sampleAccent,
}: {
  src: string | null
  style: React.CSSProperties
  fit: string
  position: string
  kenBurns: boolean
  crossfade: boolean
  sampleAccent: boolean
}) {
  // The outgoing image, written to directly rather than held in state: it only
  // exists for the new image to fade over.
  const previousRef = useRef<HTMLDivElement>(null)
  const shownRef = useRef<string | null>(null)

  useEffect(() => {
    if (!src) return
    const node = previousRef.current
    if (node) {
      node.style.backgroundImage = shownRef.current
        ? `url("${cssUrl(shownRef.current)}")`
        : 'none'
    }
    shownRef.current = src
  }, [src])

  useEffect(() => {
    if (!sampleAccent || !src) return
    let alive = true
    // Works for hosts that send CORS headers, fails quietly otherwise.
    void dominantColor(src, true).then((colour) => {
      if (alive) accentStore.set(colour)
    })
    return () => {
      alive = false
    }
  }, [sampleAccent, src])

  if (!src) return null

  const layerStyle: React.CSSProperties = {
    ...style,
    backgroundSize: fit === 'tile' ? 'auto' : fit,
    backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: position,
  }

  return (
    <>
      {crossfade ? (
        <div ref={previousRef} className="bg__media bg__media--image" style={layerStyle} />
      ) : null}
      <div
        // Keying on the source restarts the fade-in for each new slide.
        key={src}
        className="bg__media bg__media--image"
        data-ken-burns={kenBurns}
        data-fade={crossfade}
        style={{ ...layerStyle, backgroundImage: `url("${cssUrl(src)}")` }}
      />
    </>
  )
}

// Blob URLs never need escaping, but a pasted remote URL can contain quotes.
const cssUrl = (src: string) => src.replace(/"/g, '%22')

function VideoLayer({
  src,
  style,
  fit,
  settings,
  sampleAccent,
}: {
  src: string | null
  style: React.CSSProperties
  fit: string
  settings: ReturnType<typeof useSettings>['background']['video']
  sampleAccent: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.playbackRate = settings.playbackRate
  }, [settings.playbackRate, src])

  // Stop decoding while the tab is in the background.
  useEffect(() => {
    const video = ref.current
    if (!video || !settings.pauseWhenHidden) return
    const sync = () => {
      if (document.hidden) video.pause()
      else void video.play().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [settings.pauseWhenHidden, src])

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!src) return null

  return (
    <video
      ref={ref}
      className="bg__media bg__media--video"
      style={{ ...style, objectFit: fit === 'tile' ? 'cover' : (fit as React.CSSProperties['objectFit']) }}
      src={src}
      autoPlay={!reducedMotion}
      loop={settings.loop}
      muted={settings.muted}
      playsInline
      disablePictureInPicture
      preload="auto"
      onLoadedData={(event) => {
        if (!sampleAccent) return
        accentStore.set(dominantColorOf(event.currentTarget))
      }}
    />
  )
}
