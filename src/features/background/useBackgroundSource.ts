import { useEffect, useMemo, useState } from 'react'
import { isExtension, localStore } from '@/core/platform/browser'
import { useAsyncValue } from '@/core/hooks'
import { mediaStore } from '@/core/storage/blobStore'
import type { Background } from '@/core/settings/schema'

export interface BackgroundSource {
  kind: 'none' | 'image' | 'video'
  /** Resolved `blob:` or remote URL, or null while still loading. */
  src: string | null
}

const CURSOR_KEY = 'slideshowCursor'

/**
 * Resolves which media the background should show right now.
 *
 * Slideshow position lives in storage and is advanced by the service worker's
 * alarm, not by a timer in the page: that way every open tab agrees on the
 * current wallpaper and rotation continues while no tab is open. Outside the
 * extension there is no worker, so the page rotates on its own instead.
 */
export function useBackgroundSource(background: Background): BackgroundSource {
  const cursor = useSlideshowCursor(background)

  const target = useMemo(() => resolveTarget(background, cursor), [background, cursor])

  const blobUrl = useAsyncValue(target.blobId ? `bg:${target.blobId}` : null, () =>
    mediaStore.url(target.blobId),
  )

  const src = target.url || blobUrl
  return { kind: src ? target.kind : 'none', src }
}

interface Target {
  kind: 'none' | 'image' | 'video'
  url: string
  blobId: string
}

function resolveTarget(background: Background, cursor: number): Target {
  if (background.type === 'image') {
    return { kind: 'image', url: background.image.url, blobId: background.image.blobId }
  }
  if (background.type === 'video') {
    return { kind: 'video', url: background.video.url, blobId: background.video.blobId }
  }
  if (background.type === 'slideshow') {
    const slides = [
      ...background.slideshow.blobIds.map((id) => ({ blobId: id, url: '' })),
      ...background.slideshow.urls.map((url) => ({ blobId: '', url })),
    ]
    if (slides.length === 0) return { kind: 'none', url: '', blobId: '' }
    const slide = slides[((cursor % slides.length) + slides.length) % slides.length]
    return { kind: 'image', ...slide }
  }
  return { kind: 'none', url: '', blobId: '' }
}

function useSlideshowCursor(background: Background): number {
  const [cursor, setCursor] = useState(0)
  const active = background.type === 'slideshow'
  const intervalMs = Math.max(1, background.slideshow.intervalMinutes) * 60_000

  useEffect(() => {
    if (!active) return
    let alive = true
    void localStore.get<number>(CURSOR_KEY).then((stored) => {
      if (alive && typeof stored === 'number') setCursor(stored)
    })
    const unsubscribe = localStore.subscribe(CURSOR_KEY, (value) => {
      if (typeof value === 'number') setCursor(value)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [active])

  // Dev fallback: no service worker means no alarm, so drive it from the page.
  useEffect(() => {
    if (!active || isExtension()) return
    const timer = setInterval(() => setCursor((c) => c + 1), intervalMs)
    return () => clearInterval(timer)
  }, [active, intervalMs])

  return cursor
}
