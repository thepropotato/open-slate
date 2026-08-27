import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Icon } from '@/core/icons'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import type { Tile as TileModel } from '@/core/settings/schema'
import { openUrl } from '@/core/platform/browser'
import { Tile } from './Tile'
import { TileEditor } from './TileEditor'
import { seedTilesFromBrowser } from './seed'
import './tiles.css'

/**
 * The speed dial band.
 *
 * Reordering is opt-in via edit mode rather than always-on drag, so that a
 * single click on a tile always navigates — the common case by far.
 */
export function TileGrid() {
  const { tiles } = useSettings()
  const { update } = useSettingsActions()
  const [editing, setEditing] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [hints, setHints] = useState(false)

  const sensors = useSensors(
    // A short distance threshold keeps clicks clicking and drags dragging.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const items = tiles.items
  const ids = useMemo(() => items.map((t) => t.id), [items])

  // First run: offer the browser's own most-visited sites rather than a blank page.
  useEffect(() => {
    if (items.length > 0) return
    let alive = true
    void seedTilesFromBrowser().then((seeded) => {
      if (!alive || seeded.length === 0) return
      update((current) =>
        current.tiles.items.length > 0
          ? current
          : { ...current, tiles: { ...current.tiles, items: seeded } },
      )
    })
    return () => {
      alive = false
    }
  }, [items.length, update])

  // Holding a modifier reveals the 1-9 shortcut badges.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setHints(event.altKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  const write = useCallback(
    (next: TileModel[]) => update((current) => ({ ...current, tiles: { ...current.tiles, items: next } })),
    [update],
  )

  // Alt+1..9 opens a tile without touching the mouse.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      const digit = Number(event.key)
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return
      const tile = items[digit - 1]
      if (!tile) return
      event.preventDefault()
      openUrl(tile.url, tiles.openIn)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, tiles.openIn])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    write(arrayMove(items, from, to))
  }

  const remove = (id: string) => write(items.filter((t) => t.id !== id))

  if (!tiles.enabled) return null

  return (
    <div className="tiles-band">
      <div
        className="tiles"
        data-label-vis={tiles.labelVisibility}
        data-favicon-vis={tiles.faviconVisibility}
        data-hover={tiles.hoverEffect}
        data-plate={tiles.plateStyle}
        data-hints={hints}
        style={
          {
            '--tile-w': `${tiles.width}px`,
            '--tile-aspect': tiles.aspect,
            '--tile-gap': `${tiles.gap}px`,
            '--tile-radius': tiles.radius === null ? 'var(--radius)' : `${tiles.radius}px`,
            '--tile-pad': `${tiles.imagePadding}px`,
            '--tile-fit': tiles.imageFit,
            '--favicon-size': `${tiles.faviconSize}px`,
            '--tile-cols': tiles.columns === 0 ? 'auto-fill' : tiles.columns,
            '--tile-label-align': tiles.labelAlign,
          } as React.CSSProperties
        }
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            {items.map((tile, index) => (
              <Tile
                key={tile.id}
                tile={tile}
                index={index}
                settings={tiles}
                editing={editing}
                onEdit={setEditorId}
                onRemove={remove}
              />
            ))}
          </SortableContext>
        </DndContext>

        {tiles.showAddButton ? (
          <button
            type="button"
            className="tile-add"
            title="Add a tile"
            aria-label="Add a tile"
            onClick={() => setCreating(true)}
          >
            <Icon name="add" />
          </button>
        ) : null}
      </div>

      <div className="tiles-band__toolbar">
        <button
          type="button"
          className="tiles-band__toggle"
          aria-pressed={editing}
          onClick={() => setEditing((on) => !on)}
          title={editing ? 'Done arranging' : 'Arrange tiles'}
        >
          <Icon name={editing ? 'check' : 'drag'} />
          <span>{editing ? 'Done' : 'Arrange'}</span>
        </button>
      </div>

      {editorId || creating ? (
        <TileEditor
          tile={items.find((t) => t.id === editorId) ?? null}
          onClose={() => {
            setEditorId(null)
            setCreating(false)
          }}
          onSave={(tile) => {
            const exists = items.some((t) => t.id === tile.id)
            write(exists ? items.map((t) => (t.id === tile.id ? tile : t)) : [...items, tile])
            setEditorId(null)
            setCreating(false)
          }}
          onDelete={
            editorId
              ? () => {
                  remove(editorId)
                  setEditorId(null)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
