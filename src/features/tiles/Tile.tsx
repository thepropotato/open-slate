import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/core/icons'
import { openUrl } from '@/core/platform/browser'
import type { Tile as TileModel, Tiles as TilesSettings } from '@/core/settings/schema'
import { useTileVisual } from './useTileVisual'

/**
 * One speed-dial tile. Renders as an anchor so middle-click, cmd-click and
 * "copy link address" all behave the way the user expects from a link.
 */
export function Tile({
  tile,
  settings,
  index,
  editing,
  onEdit,
  onRemove,
}: {
  tile: TileModel
  settings: TilesSettings
  index: number
  editing: boolean
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const visual = useTileVisual(tile, settings)
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: tile.id,
    disabled: !editing,
  })
  const placement = tile.labelPlacement ?? settings.labelPlacement

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.85 : undefined,
  }

  return (
    <div
      className="tile"
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
    >
      <a
        className="tile__plate"
        href={tile.url}
        style={{ background: visual.plate ?? 'transparent', color: visual.ink }}
        title={visual.title}
        onClick={(event) => {
          // Let the browser handle modified clicks natively.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
          event.preventDefault()
          openUrl(tile.url, settings.openIn)
        }}
      >
        <TileArt art={visual.art} title={visual.title} />

        {index < 9 ? <span className="tile__hint">{index + 1}</span> : null}

        <img
          className="tile__favicon"
          data-corner={settings.faviconCorner}
          src={visual.faviconSrc}
          alt=""
          loading="lazy"
        />

        {placement === 'inside-bottom' || placement === 'inside-top' ? (
          <span className={`tile__label tile__label--inside tile__label--${placement}`}
            style={{ color: '#fff' }}>
            {visual.title}
          </span>
        ) : null}
      </a>

      {editing ? (
        <div className="tile__actions">
          <button
            type="button"
            className="tile__action"
            title="Edit tile"
            aria-label={`Edit ${visual.title}`}
            onClick={() => onEdit(tile.id)}
          >
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="tile__action"
            title="Remove tile"
            aria-label={`Remove ${visual.title}`}
            onClick={() => onRemove(tile.id)}
          >
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      {placement === 'below' ? (
        <span className="tile__label tile__label--below">{visual.title}</span>
      ) : null}
    </div>
  )
}

function TileArt({ art, title }: { art: ReturnType<typeof useTileVisual>['art']; title: string }) {
  if (art.kind === 'brand') {
    return (
      <svg
        className="tile__mark tile__mark--svg"
        viewBox="0 0 24 24"
        role="img"
        aria-label={title}
        style={{ color: art.colour }}
      >
        <path d={art.path} />
      </svg>
    )
  }
  if (art.kind === 'image') {
    return <img className="tile__mark" src={art.src} alt="" loading="lazy" decoding="async" />
  }
  return (
    <span className="tile__monogram" style={{ color: art.colour }} aria-label={title}>
      {art.text}
    </span>
  )
}
