import { useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button } from '@/core/ui'
import { measureMedia, mediaStore, type MediaMeta } from '@/core/storage/blobStore'
import { useDraftSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { uid } from '@/core/util/id'
import './MediaLibrary.css'

/** Warn before storing something big enough to slow the new tab down. */
const LARGE_FILE_BYTES = 60 * 1024 * 1024

/**
 * Local wallpaper library, doubling as the picker. Media lives in IndexedDB and
 * never leaves the browser; a thumbnail's actions depend on the current
 * background type.
 */
export function MediaLibrary() {
  // The draft, not the saved settings: the type switch above is a staged edit,
  // so reading what is saved would go on offering slideshow buttons after the
  // reader has already switched to a single image.
  const { background } = useDraftSettings()
  const { update } = useSettingsActions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Bumped after any write to re-read the store. */
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision((n) => n + 1)

  const contents = useAsyncValue(`media:${revision}`, async () => ({
    items: await mediaStore.list(),
    usage: await mediaStore.usage(),
  }))
  const items: MediaMeta[] = contents?.items ?? []
  const usage = contents?.usage ?? null

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        if (!/^(image|video)\//.test(file.type)) {
          setError(`${file.name} is not an image or a video.`)
          continue
        }
        if (file.size > LARGE_FILE_BYTES) {
          setError(`${file.name} is ${formatBytes(file.size)}. Large files slow the new tab down.`)
        }
        const { width, height } = await measureMedia(file)
        await mediaStore.put({
          id: uid(file.type.startsWith('video') ? 'vid' : 'img'),
          name: file.name,
          type: file.type,
          size: file.size,
          width,
          height,
          blob: file,
        })
      }
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await mediaStore.remove(id)
    // Drop the reference too, or the background points at nothing.
    update((current) => ({
      ...current,
      background: {
        ...current.background,
        image: {
          ...current.background.image,
          blobId: current.background.image.blobId === id ? '' : current.background.image.blobId,
        },
        video: {
          ...current.background.video,
          blobId: current.background.video.blobId === id ? '' : current.background.video.blobId,
        },
        slideshow: {
          ...current.background.slideshow,
          blobIds: current.background.slideshow.blobIds.filter((b) => b !== id),
        },
      },
    }))
    refresh()
  }

  const pickStill = (id: string) =>
    update((current) => ({
      ...current,
      background: {
        ...current.background,
        type: 'image',
        image: { ...current.background.image, blobId: id, url: '' },
      },
    }))

  const pickVideo = (id: string) =>
    update((current) => ({
      ...current,
      background: {
        ...current.background,
        type: 'video',
        video: { ...current.background.video, blobId: id, url: '' },
      },
    }))

  const toggleInSlideshow = (id: string) =>
    update((current) => {
      const have = current.background.slideshow.blobIds
      return {
        ...current,
        background: {
          ...current.background,
          slideshow: {
            ...current.background.slideshow,
            blobIds: have.includes(id) ? have.filter((b) => b !== id) : [...have, id],
          },
        },
      }
    })

  const inSlideshow = new Set(background.slideshow.blobIds)

  return (
    <div className="library">
      <div className="library__actions">
        <label className="ctl-btn ctl-btn--primary">
          <Icon name={busy ? 'spinner' : 'upload'} spin={busy} />
          <span>Add images or video</span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(event) => void add(event.target.files)}
          />
        </label>
        {usage ? (
          <span className="library__usage">
            {formatBytes(usage.used)} used
            {usage.quota ? ` of ${formatBytes(usage.quota)}` : ''}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="library__error">
          <Icon name="warning" /> {error}
        </p>
      ) : null}

      {background.type === 'slideshow' && inSlideshow.size === 0 && items.length > 0 ? (
        <p className="library__hint">
          <Icon name="info" /> A slideshow needs at least one picture. Include the ones you want
          it to turn between.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="library__empty">
          {background.type === 'slideshow'
            ? 'Add some pictures for the slideshow to turn between. They stay on this device.'
            : 'Nothing stored yet. Files you add stay on this device.'}
        </p>
      ) : (
        <ul className="library__grid">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              // The chosen still or video, as opposed to one of many slides.
              current={
                (background.type === 'image' && background.image.blobId === item.id) ||
                (background.type === 'video' && background.video.blobId === item.id)
              }
              // Ringed for what the wallpaper is actually using now, not for a
              // blob id left behind by a type that is no longer showing.
              active={
                background.type === 'slideshow'
                  ? inSlideshow.has(item.id)
                  : (background.type === 'image' && background.image.blobId === item.id) ||
                    (background.type === 'video' && background.video.blobId === item.id)
              }
              inSlideshow={inSlideshow.has(item.id)}
              slideshowRunning={background.type === 'slideshow'}
              // Video plays videos; every other type shows a still.
              usable={
                background.type === 'video'
                  ? item.type.startsWith('video/')
                  : !item.type.startsWith('video/')
              }
              onUseStill={() => pickStill(item.id)}
              onUseVideo={() => pickVideo(item.id)}
              onToggleSlideshow={() => toggleInSlideshow(item.id)}
              onRemove={() => void remove(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MediaCard({
  item,
  active,
  current,
  inSlideshow,
  slideshowRunning,
  usable,
  onUseStill,
  onUseVideo,
  onToggleSlideshow,
  onRemove,
}: {
  item: MediaMeta
  active: boolean
  /** Whether this is the wallpaper on screen right now. */
  current: boolean
  inSlideshow: boolean
  /** Whether the slideshow is the active background type at all. */
  slideshowRunning: boolean
  /** Whether this file is the kind the current type can show. */
  usable: boolean
  onUseStill: () => void
  onUseVideo: () => void
  onToggleSlideshow: () => void
  onRemove: () => void
}) {
  const url = useAsyncValue(`media-url:${item.id}`, () => mediaStore.url(item.id))
  const isVideo = item.type.startsWith('video/')

  return (
    <li className="media" data-active={active}>
      <div className="media__thumb">
        {url ? (
          isVideo ? (
            <video src={url} muted playsInline preload="metadata" />
          ) : (
            <img src={url} alt={item.name} loading="lazy" />
          )
        ) : null}
        {isVideo ? (
          <span className="media__badge">
            <Icon name="video" />
          </span>
        ) : null}
        {/* Only the single wallpaper needs marking; the button below says the
            rest, and a badge on every card marks nothing. */}
        {current && !slideshowRunning ? (
          <span className="media__badge media__badge--use">In use</span>
        ) : null}
      </div>

      <div className="media__meta">
        <span className="media__name" title={item.name}>
          {item.name}
        </span>
        <span className="media__sub">
          {item.width && item.height ? `${item.width}x${item.height} · ` : ''}
          {formatBytes(item.size)}
        </span>
      </div>

      {/* Only what this mode can show: using a still while the type is video
          would switch the type out from under the reader. */}
      <div className="media__row">
        {slideshowRunning && !isVideo ? (
          <Button
            variant={inSlideshow ? 'primary' : 'ghost'}
            icon={inSlideshow ? 'check' : 'add'}
            onClick={onToggleSlideshow}
            title={inSlideshow ? 'Take out of the slideshow' : 'Add to the slideshow'}
          >
            {inSlideshow ? 'Included' : 'Include'}
          </Button>
        ) : usable ? (
          <Button
            variant="ghost"
            icon={isVideo ? 'video' : 'image'}
            onClick={isVideo ? onUseVideo : onUseStill}
            disabled={current}
          >
            {current ? 'In use' : 'Use'}
          </Button>
        ) : (
          <span className="media__idle">{isVideo ? 'A video' : 'A picture'}</span>
        )}
        <Button variant="ghost" icon="remove" onClick={onRemove} title={`Delete ${item.name}`} />
      </div>
    </li>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
