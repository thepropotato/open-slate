import { useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { measureMedia, mediaStore, type MediaMeta } from '@/core/storage/blobStore'
import { useDraftSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { uid } from '@/core/util/id'
import './MediaLibrary.css'

/** Warn before storing something big enough to slow the new tab down. */
const LARGE_FILE_BYTES = 60 * 1024 * 1024

/**
 * Local wallpaper library, doubling as the picker. Media lives in IndexedDB and
 * never leaves the browser; thumbnails are directly clickable to apply.
 */
export function MediaLibrary() {
  const { background } = useDraftSettings()
  const { update } = useSettingsActions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [dragOver, setDragOver] = useState(false)
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
    <div
      className="library"
      data-drag-over={dragOver || undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files?.length) {
          void add(e.dataTransfer.files)
        }
      }}
    >
      {/* Header row with heading, usage subtext on left, and upload button on far right */}
      <div className="library__header">
        <div className="library__header-info">
          <h3 className="library__title">Your media</h3>
          {usage ? (
            <p className="library__subtext">
              {formatBytes(usage.used)} used of {usage.quota ? formatBytes(usage.quota) : 'storage'}
              {items.length > 0 ? ` · ${items.length} ${items.length === 1 ? 'wallpaper' : 'wallpapers'}` : ''}
            </p>
          ) : (
            <p className="library__subtext">Stored in this browser only. Nothing is uploaded anywhere.</p>
          )}
        </div>

        <label className="ctl-btn ctl-btn--primary library__upload-btn">
          <Icon name={busy ? 'spinner' : 'upload'} spin={busy} />
          <span>Upload media</span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(event) => void add(event.target.files)}
            disabled={busy}
          />
        </label>
      </div>

      {error ? (
        <p className="library__error">
          <Icon name="warning" /> {error}
        </p>
      ) : null}

      {background.type === 'slideshow' && inSlideshow.size === 0 && items.length > 0 ? (
        <p className="library__hint">
          <Icon name="info" /> Click wallpapers to add or remove them from rotation.
        </p>
      ) : null}

      {items.length === 0 ? (
        <label className="library__empty-zone">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(event) => void add(event.target.files)}
            disabled={busy}
          />
          <div className="library__empty-icon">
            <Icon name={busy ? 'spinner' : 'upload'} spin={busy} />
          </div>
          <span className="library__empty-title">No wallpapers uploaded yet</span>
          <span className="library__empty-hint">Drop images or video here, or click "Upload media" above</span>
        </label>
      ) : (
        <ul className="library__grid">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              current={
                (background.type === 'image' && background.image.blobId === item.id) ||
                (background.type === 'video' && background.video.blobId === item.id)
              }
              active={
                background.type === 'slideshow'
                  ? inSlideshow.has(item.id)
                  : (background.type === 'image' && background.image.blobId === item.id) ||
                    (background.type === 'video' && background.video.blobId === item.id)
              }
              inSlideshow={inSlideshow.has(item.id)}
              slideshowRunning={background.type === 'slideshow'}
              onSelect={() => {
                if (background.type === 'slideshow') {
                  if (!item.type.startsWith('video/')) {
                    toggleInSlideshow(item.id)
                  }
                } else if (item.type.startsWith('video/')) {
                  pickVideo(item.id)
                } else {
                  pickStill(item.id)
                }
              }}
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
  onSelect,
  onRemove,
}: {
  item: MediaMeta
  active: boolean
  current: boolean
  inSlideshow: boolean
  slideshowRunning: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const url = useAsyncValue(`media-url:${item.id}`, () => mediaStore.url(item.id))
  const isVideo = item.type.startsWith('video/')

  return (
    <li className="media" data-active={active} data-current={current}>
      <button
        type="button"
        className="media__card-btn"
        onClick={onSelect}
        title={
          slideshowRunning
            ? inSlideshow
              ? `Remove ${item.name} from rotation`
              : `Include ${item.name} in rotation`
            : current
              ? `Active wallpaper: ${item.name}`
              : `Set ${item.name} as wallpaper`
        }
      >
        <div className="media__thumb">
          {url ? (
            isVideo ? (
              <video src={url} muted playsInline preload="metadata" />
            ) : (
              <img src={url} alt={item.name} loading="lazy" />
            )
          ) : null}

          {isVideo ? (
            <span className="media__type-badge" title="Video wallpaper">
              <Icon name="video" />
            </span>
          ) : null}

          {/* Elegant active/rotation indicator pill */}
          {current && !slideshowRunning ? (
            <span className="media__status-pill media__status-pill--active">
              <span className="media__status-dot" />
              <span>Active</span>
            </span>
          ) : slideshowRunning && inSlideshow ? (
            <span className="media__status-pill media__status-pill--slideshow">
              <Icon name="check" />
              <span>In rotation</span>
            </span>
          ) : (
            <span className="media__hover-hint">
              {slideshowRunning ? '+ In rotation' : 'Set active'}
            </span>
          )}
        </div>
      </button>

      <button
        type="button"
        className="media__delete-btn is-icon-btn"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title={`Delete ${item.name}`}
        aria-label={`Delete ${item.name}`}
      >
        <Icon name="remove" />
      </button>

      <div className="media__meta">
        <span className="media__name" title={item.name}>
          {item.name}
        </span>
        <span className="media__sub">
          {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
          {formatBytes(item.size)}
        </span>
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
