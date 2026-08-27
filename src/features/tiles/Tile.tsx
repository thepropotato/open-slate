import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import { Icon } from '@/core/icons'
import { openUrl } from '@/core/platform/browser'
import type { Tile as TileModel, Tiles as TilesSettings } from '@/core/settings/schema'
import { useTileVisual, type TileArt } from './useTileVisual'

/**
 * One speed-dial tile.
 *
 * Presentational only: it knows nothing about dragging. The sortable wrapper
 * passes drag plumbing in through `drag`, which keeps the drag library off the
 * page entirely until the user actually enters Arrange mode.
 */
export interface TileDrag {
  ref: Ref<HTMLDivElement>
  handleProps: HTMLAttributes<HTMLElement>
  style: CSSProperties
  dragging: boolean
  /** True while a dragged tile hovers this folder. */
  dropTarget?: boolean
}

export function Tile({
  tile,
  settings,
  index,
  editing,
  showHint,
  drag,
  childUrls,
  onOpenFolder,
  onEdit,
  onRemove,
}: {
  tile: TileModel
  settings: TilesSettings
  index: number
  editing: boolean
  showHint: boolean
  drag?: TileDrag
  /** URLs inside this folder, for its preview grid. */
  childUrls?: string[]
  onOpenFolder?: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const visual = useTileVisual(tile, settings, childUrls)
  const isFolder = tile.kind === 'folder'
  const placement = tile.labelPlacement ?? settings.labelPlacement

  return (
    <div
      className="tile"
      ref={drag?.ref}
      style={drag?.style}
      data-dragging={drag?.dragging}
      data-drop-target={drag?.dropTarget}
      {...(drag?.handleProps ?? {})}
    >
      {/*
        A site tile is an anchor so middle-click, cmd-click and "copy link
        address" behave as expected. A folder has no address, so it is a button.
      */}
      <Plate
        isFolder={isFolder}
        url={tile.url}
        title={visual.title}
        /*
          In Arrange mode a tile is something you move, not something you follow:
          the plate stops navigating so a drag that ends short of the threshold
          cannot fire off to the site instead of putting the tile back down.
        */
        inert={editing}
        style={{ background: visual.plate ?? 'transparent', color: visual.ink }}
        onActivate={() => (isFolder ? onOpenFolder?.(tile.id) : openUrl(tile.url, settings.openIn))}
      >
        <TileArtwork art={visual.art} title={visual.title} />

        {showHint && index < 9 ? <span className="tile__hint">{index + 1}</span> : null}

        {placement === 'inside-bottom' || placement === 'inside-top' ? (
          <span
            className={`tile__label tile__label--inside tile__label--${placement}`}
            style={{ color: '#fff' }}
          >
            {visual.title}
          </span>
        ) : null}
      </Plate>

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

function Plate({
  isFolder,
  url,
  title,
  style,
  inert,
  onActivate,
  children,
}: {
  isFolder: boolean
  url: string
  title: string
  style: CSSProperties
  /** Arrange mode: draw the plate, but do not let it lead anywhere. */
  inert: boolean
  onActivate: () => void
  children: ReactNode
}) {
  /*
   * Arrange mode takes the plate out of the page's interactive surface
   * altogether, rather than only suppressing its click.
   *
   * Dropping the handler alone left a control that still took focus, still lit
   * up under the pointer and still fired on Enter — a tile that looked and felt
   * clickable while doing nothing, which reads as a broken tile rather than a
   * deliberate mode. `data-inert` drives the styling; `tabIndex` and the
   * missing href take it out of the tab order and out of the browser's own
   * link handling.
   */
  if (isFolder) {
    return (
      <button
        type="button"
        className="tile__plate"
        style={style}
        title={title}
        data-inert={inert}
        tabIndex={inert ? -1 : undefined}
        aria-hidden={inert || undefined}
        onMouseDown={inert ? (event) => event.preventDefault() : undefined}
        onClick={inert ? undefined : onActivate}
      >
        {children}
      </button>
    )
  }
  return (
    <a
      className="tile__plate"
      // Without an href this is no longer a link, so cmd-click, middle-click and
      // the browser's own link drag all stop competing with the reorder drag.
      href={inert ? undefined : url}
      style={style}
      title={title}
      data-inert={inert}
      tabIndex={inert ? -1 : undefined}
      aria-hidden={inert || undefined}
      // Keeps the click from focusing a plate that no longer does anything.
      onMouseDown={inert ? (event) => event.preventDefault() : undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault()
          return
        }
        // Let the browser handle modified clicks natively.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onActivate()
      }}
    >
      {children}
    </a>
  )
}

function TileArtwork({ art, title }: { art: TileArt; title: string }) {
  if (art.kind === 'folder') {
    return (
      <span className="tile__folder" aria-label={`${title}, ${art.count} items`}>
        {art.icons.length === 0 ? (
          <Icon name="folder" className="tile__folderempty" />
        ) : (
          art.icons.map((src, index) => <img key={index} src={src} alt="" loading="lazy" />)
        )}
      </span>
    )
  }
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
  if (art.kind === 'image' || art.kind === 'favicon') {
    return (
      <img
        className={`tile__mark${art.kind === 'favicon' ? ' tile__mark--favicon' : ''}`}
        src={art.src}
        alt=""
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <span className="tile__monogram" style={{ color: art.colour }} aria-label={title}>
      {art.text}
    </span>
  )
}
