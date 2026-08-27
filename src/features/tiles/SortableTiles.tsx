import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tile as TileModel, Tiles as TilesSettings } from '@/core/settings/schema'
import { Tile } from './Tile'

/**
 * Drag-to-reorder, loaded only when the user enters Arrange mode.
 *
 * The drag library is a meaningful share of the new tab's bundle and is needed
 * for a rare, deliberate action — so it stays out of the default path entirely.
 */
export function SortableTiles({
  items,
  settings,
  showHint,
  childUrlsFor,
  onReorder,
  onMoveToFolder,
  onOpenFolder,
  onEdit,
  onRemove,
}: {
  items: TileModel[]
  settings: TilesSettings
  showHint: boolean
  childUrlsFor?: (id: string) => string[]
  onReorder: (next: TileModel[]) => void
  /** Called when a tile is dropped onto a folder. */
  onMoveToFolder?: (tileId: string, folderId: string) => void
  onOpenFolder?: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const sensors = useSensors(
    // A short distance threshold keeps clicks clicking and drags dragging.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = items.map((tile) => tile.id)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    // Dropping onto a folder files the tile away instead of reordering. Folders
    // do not nest, so a folder dropped on a folder still just reorders.
    const target = items.find((tile) => tile.id === overId)
    const dragged = items.find((tile) => tile.id === activeId)
    if (onMoveToFolder && target?.kind === 'folder' && dragged?.kind !== 'folder') {
      onMoveToFolder(activeId, overId)
      return
    }

    const from = ids.indexOf(activeId)
    const to = ids.indexOf(overId)
    if (from < 0 || to < 0) return
    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {items.map((tile, index) => (
          <SortableTile
            key={tile.id}
            tile={tile}
            index={index}
            settings={settings}
            showHint={showHint}
            childUrls={childUrlsFor?.(tile.id)}
            onOpenFolder={onOpenFolder}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableTile({
  tile,
  index,
  settings,
  showHint,
  childUrls,
  onOpenFolder,
  onEdit,
  onRemove,
}: {
  tile: TileModel
  index: number
  settings: TilesSettings
  showHint: boolean
  childUrls?: string[]
  onOpenFolder?: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { setNodeRef, transform, transition, isDragging, isOver, attributes, listeners } =
    useSortable({ id: tile.id })

  return (
    <Tile
      tile={tile}
      index={index}
      settings={settings}
      editing
      showHint={showHint}
      childUrls={childUrls}
      onOpenFolder={onOpenFolder}
      onEdit={onEdit}
      onRemove={onRemove}
      drag={{
        ref: setNodeRef,
        handleProps: { ...attributes, ...listeners },
        style: {
          transform: CSS.Transform.toString(transform),
          transition: transition ?? undefined,
          opacity: isDragging ? 0.85 : undefined,
        },
        dragging: isDragging,
        // Highlights a folder that is about to receive the dragged tile.
        dropTarget: isOver && tile.kind === 'folder',
      }}
    />
  )
}
