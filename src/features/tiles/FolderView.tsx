import { Suspense } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { Icon } from '@/core/icons'
import { Modal } from '@/core/ui'
import type { Tile as TileModel, Tiles as TilesSettings } from '@/core/settings/schema'
import { Tile } from './Tile'
import { folderChildren } from './folders'

const SortableTiles = lazyChunk(() =>
  import('./SortableTiles').then((m) => ({ default: m.SortableTiles })),
)

// A dialog rather than an inline expansion, which would reflow the grid and
// push the search box and widgets around.
export function FolderView({
  folder,
  items,
  settings,
  editing,
  onReorder,
  onRemoveFromFolder,
  onEdit,
  onRemove,
  onClose,
}: {
  folder: TileModel | null
  items: TileModel[]
  settings: TilesSettings
  editing: boolean
  onReorder: (next: TileModel[]) => void
  onRemoveFromFolder: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  if (!folder) return null

  const children = folderChildren(items, folder.id)

  const gridStyle = {
    '--tile-w': `${Math.min(settings.width, 150)}px`,
    '--tile-aspect': settings.aspect,
    '--tile-gap': `${settings.gap}px`,
    '--tile-radius': settings.radius === null ? 'var(--radius)' : `${settings.radius}px`,
    '--tile-pad': `${settings.imagePadding}px`,
    '--tile-fit': settings.imageFit,
  } as React.CSSProperties

  // No drag plumbing: the normal path, and the Arrange fallback.
  const plainTiles = (arranging: boolean) =>
    children.map((tile, index) => (
      <Tile
        key={tile.id}
        tile={tile}
        index={index}
        settings={settings}
        editing={arranging}
        showHint={false}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    ))

  return (
    <Modal title={folder.title || 'Folder'} width={680} onClose={onClose}>
      {children.length === 0 ? (
        <p className="folder__empty">
          <Icon name="info" /> This folder is empty. In Arrange mode, drag a tile onto it to file
          it here.
        </p>
      ) : (
        <div
          className="tiles"
          data-label-vis="always"
          data-hover={settings.hoverEffect}
          data-plate={settings.plateStyle}
          style={gridStyle}
        >
          {editing ? (
            // Plain tiles stand in while the drag chunk loads.
            <Suspense fallback={plainTiles(true)}>
              <SortableTiles
                items={children}
                settings={settings}
                showHint={false}
                onReorder={onReorder}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            </Suspense>
          ) : (
            plainTiles(false)
          )}
        </div>
      )}

      {editing && children.length > 0 ? (
        <ul className="folder__manage">
          {children.map((tile) => (
            <li key={tile.id}>
              <span>{tile.title || tile.url}</span>
              <button
                type="button"
                onClick={() => onRemoveFromFolder(tile.id)}
                title="Move back out of the folder"
              >
                <Icon name="open" /> Move out
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  )
}
