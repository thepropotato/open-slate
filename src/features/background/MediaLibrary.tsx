import { useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button } from '@/core/ui'
import { measureMedia, mediaStore, type MediaMeta } from '@/core/storage/blobStore'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { uid } from '@/core/util/id'
import './MediaLibrary.css'

/** Warn before storing something big enough to slow the new tab down. */
const LARGE_FILE_BYTES = 60 * 1024 * 1024

/**
 * Local wallpaper library.
 *
 * Media lives in IndexedDB and never leaves the browser. The library doubles as
 * the picker: which selection action a thumbnail offers depends on whether the
 * current background is a still, a video or a slideshow.
 */
export function MediaLibrary() {
  const { background } = useSettings()
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
          setError(`${file.name} is ${formatBytes(file.size)} — large files slow the new tab down.`)
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
      background: { ...current.background, type: 'image', image: { blobId: id, url: '' } },
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

      {items.length === 0 ? (
        <p className="library__empty">
          Nothing stored yet. Files you add stay on this device.
        </p>
      ) : (
        <ul className="library__grid">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              active={
                background.image.blobId === item.id ||
                background.video.blobId === item.id ||
                inSlideshow.has(item.id)
              }
              inSlideshow={inSlideshow.has(item.id)}
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
  inSlideshow,
  onUseStill,
  onUseVideo,
  onToggleSlideshow,
  onRemove,
}: {
  item: MediaMeta
  active: boolean
  inSlideshow: boolean
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

      <div className="media__row">
        {isVideo ? (
          <Button variant="ghost" icon="video" onClick={onUseVideo}>
            Use
          </Button>
        ) : (
          <>
            <Button variant="ghost" icon="image" onClick={onUseStill}>
              Use
            </Button>
            <Button
              variant={inSlideshow ? 'primary' : 'ghost'}
              icon={inSlideshow ? 'check' : 'add'}
              onClick={onToggleSlideshow}
              title="Include in the slideshow"
            />
          </>
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
