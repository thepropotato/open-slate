import { useEffect, useMemo, useState } from 'react'
import { isExtension, localStore } from '@/core/platform/browser'
import { useAsyncValue } from '@/core/hooks'
import { mediaStore } from '@/core/storage/blobStore'
import type { Background } from '@/core/settings/schema'
import { CURSOR_KEY, pickForTab } from './slideshow'

export interface BackgroundSource {
  kind: 'none' | 'image' | 'video'
  /** Resolved `blob:` or remote URL, or null while still loading. */
  src: string | null
}

/**
 * Which media the background shows right now. Slideshow position lives in
 * storage and is advanced by the service worker's alarm, not a page timer, so
 * every tab agrees and rotation continues with no tab open.
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
  const active = background.type === 'slideshow'
  const perTab = background.slideshow.onNewTab
  const intervalMs = Math.max(1, background.slideshow.intervalMinutes) * 60_000

  const count = background.slideshow.blobIds.length + background.slideshow.urls.length
  const shuffle = background.slideshow.shuffle

  // Drawn once at mount rather than in an effect, so the first paint is already
  // this tab's slide and no second render follows.
  const [cursor, setCursor] = useState(() =>
    active && perTab && shuffle ? pickForTab(null, count, true) : 0,
  )

  // Uncoordinated on purpose: tabs opened together should differ.
  useEffect(() => {
    if (!active || !perTab || shuffle || count <= 1) return
    let alive = true
    void localStore.get<number>(CURSOR_KEY).then((stored) => {
      if (!alive) return
      const next = pickForTab(typeof stored === 'number' ? stored : null, count, false)
      setCursor(next)
      void localStore.set(CURSOR_KEY, next)
    })
    return () => {
      alive = false
    }
  }, [active, perTab, shuffle, count])

  useEffect(() => {
    if (!active || perTab) return
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
  }, [active, perTab])

  // Dev fallback: no service worker means no alarm, so drive it from the page.
  useEffect(() => {
    if (!active || perTab || isExtension()) return
    const timer = setInterval(() => setCursor((c) => c + 1), intervalMs)
    return () => clearInterval(timer)
  }, [active, perTab, intervalMs])

  return cursor
}
