import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import { Icon } from '@/core/icons'
import { openUrl } from '@/core/platform/browser'
import type { Tile as TileModel, Tiles as TilesSettings } from '@/core/settings/schema'
import { useTileVisual, type TileArt } from './useTileVisual'

/**
 * One speed-dial tile. Presentational only: the sortable wrapper passes drag
 * plumbing in through `drag`, keeping the drag library off the page until the
 * reader arranges. Absent `drag`, the tile has no chrome and cannot be moved.
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
  showHint,
  drag,
  childUrls,
  onOpenFolder,
}: {
  tile: TileModel
  settings: TilesSettings
  index: number
  showHint: boolean
  drag?: TileDrag
  /** URLs inside this folder, for its preview grid. */
  childUrls?: string[]
  onOpenFolder?: (id: string) => void
}) {
  const visual = useTileVisual(tile, settings, childUrls)
  const isFolder = tile.kind === 'folder'
  // A label inside an icon would be text floating over a transparent square, so
  // that style takes the name underneath and ignores both placement settings.
  const placement =
    settings.style === 'icon' ? 'below' : tile.labelPlacement ?? settings.labelPlacement

  return (
    <div
      className="tile"
      ref={drag?.ref}
      style={drag?.style}
      data-tile-id={tile.id}
      data-dragging={drag?.dragging}
      data-drop-target={drag?.dropTarget}
    >
      {/* An anchor, so middle-click and "copy link address" work; a folder has
          no address, so it is a button. */}
      <Plate
        isFolder={isFolder}
        url={tile.url}
        title={visual.title}
        // An icon has no plate to colour, and the background is inline, so it
        // has to be dropped here rather than in the stylesheet.
        style={{
          background: settings.style === 'icon' ? 'transparent' : visual.plate ?? 'transparent',
          color: visual.ink,
        }}
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

      {/* The whole tile, not a corner chip: at rest there is no chrome at all. */}
      {drag ? (
        <span
          className="tile__grip"
          title="Drag to move"
          aria-label={`Move ${visual.title}`}
          {...drag.handleProps}
        />
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
  onActivate,
  children,
}: {
  isFolder: boolean
  url: string
  title: string
  style: CSSProperties
  onActivate: () => void
  children: ReactNode
}) {
  // Inert takes the plate out of the interactive surface entirely, not just its
  // click: otherwise it still takes focus, hovers and fires on Enter.
  if (isFolder) {
    return (
      <button type="button" className="tile__plate" style={style} title={title} onClick={onActivate}>
        {children}
      </button>
    )
  }
  return (
    <a
      className="tile__plate"
      // Without an href this is no longer a link, so cmd-click, middle-click and
      // the browser's own link drag all stop competing with the reorder drag.
      href={url}
      style={style}
      title={title}
      // The browser's own link-drag would race the reordering one.
      draggable={false}
      onClick={(event) => {
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
