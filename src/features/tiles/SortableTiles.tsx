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
  onReorder,
  onEdit,
  onRemove,
}: {
  items: TileModel[]
  settings: TilesSettings
  showHint: boolean
  onReorder: (next: TileModel[]) => void
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
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
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
  onEdit,
  onRemove,
}: {
  tile: TileModel
  index: number
  settings: TilesSettings
  showHint: boolean
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: tile.id,
  })

  return (
    <Tile
      tile={tile}
      index={index}
      settings={settings}
      editing
      showHint={showHint}
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
      }}
    />
  )
}
