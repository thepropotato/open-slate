import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { Icon } from '@/core/icons'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import type { Tile as TileModel } from '@/core/settings/schema'
import { openUrl } from '@/core/platform/browser'
import { Tile } from './Tile'
import {
  ROOT,
  folderChildren,
  moveToFolder,
  pageIds,
  pageName,
  removeTile,
  reorderWithin,
  tilesIn,
} from './folders'
import { seedTilesFromBrowser } from './seed'
import { useGridArrows } from './useGridArrows'
import { useContextMenu } from '@/features/menu/useContextMenu'
import { useArrange } from '@/features/menu/ArrangeContext'
import type { MenuItem } from '@/features/menu/ContextMenu'
import './tiles.css'

// Lazy: the editor carries the brand picker and the media store.
const TileEditor = lazyChunk(() => import('./TileEditor').then((m) => ({ default: m.TileEditor })))

// Lazy: the drag library is only needed while arranging.
const SortableTiles = lazyChunk(() =>
  import('./SortableTiles').then((m) => ({ default: m.SortableTiles })),
)

const FolderView = lazyChunk(() => import('./FolderView').then((m) => ({ default: m.FolderView })))

/**
 * The speed dial band. Reordering is opt-in via Arrange mode so a single click
 * always navigates. Pages and folders are derived from the flat list; see
 * `folders.ts`.
 */
export function TileGrid() {
  const { tiles, behavior } = useSettings()
  const { update } = useSettingsActions()
  const [editorId, setEditorId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ kind: 'link' | 'folder' } | null>(null)
  const [hints, setHints] = useState(false)
  const [pageId, setPageId] = useState<string>(ROOT)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const arrange = useArrange()

  useGridArrows(gridRef, 'a.tile__plate, button.tile__plate')

  const items = tiles.items
  const pages = useMemo(() => pageIds(tiles.pages), [tiles.pages])

  // Derived, not corrected in an effect: a deleted page falls back without a
  // second render.
  const activePage = pages.includes(pageId) ? pageId : ROOT

  const visible = useMemo(
    () => tilesIn(items, tiles.pages, activePage, ROOT),
    [items, tiles.pages, activePage],
  )

  const write = useCallback(
    (next: TileModel[]) =>
      update((current) => ({ ...current, tiles: { ...current.tiles, items: next } })),
    [update],
  )

  const childUrlsFor = useCallback(
    (id: string) => folderChildren(items, id).map((tile) => tile.url),
    [items],
  )

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

  // Holding Alt reveals the 1-9 shortcut badges.
  const shortcuts = behavior.tileNumberShortcuts
  useEffect(() => {
    if (!shortcuts) return
    const onKey = (event: KeyboardEvent) => setHints(event.altKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [shortcuts])

  // Alt+1..9 opens a tile on the current page without touching the mouse.
  useEffect(() => {
    if (!shortcuts) return
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      const digit = Number(event.key)
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return
      const tile = visible[digit - 1]
      if (!tile) return
      event.preventDefault()
      if (tile.kind === 'folder') setOpenFolder(tile.id)
      else openUrl(tile.url, tiles.openIn)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, tiles.openIn, shortcuts])

  const remove = useCallback(
    (id: string) => write(removeTile(items, id)),
    [items, write],
  )

  const buildMenu = useCallback(
    (event: React.MouseEvent): MenuItem[] => {
      const id = (event.target as HTMLElement).closest<HTMLElement>('.tile')?.dataset.tileId
      const tile = id ? items.find((item) => item.id === id) : undefined

      const forTile: MenuItem[] = !tile
        ? []
        : [
            // A folder has no address to open.
            ...(tile.kind === 'folder'
              ? []
              : [
                  {
                    id: 'open-new',
                    label: 'Open in a new tab',
                    icon: 'external' as const,
                    onSelect: () => openUrl(tile.url, 'newTab'),
                  },
                ]),
            {
              id: 'edit',
              label: tile.kind === 'folder' ? 'Rename' : 'Edit',
              icon: 'edit',
              onSelect: () => setEditorId(tile.id),
            },
            {
              id: 'remove',
              label: 'Remove',
              icon: 'remove',
              danger: true,
              onSelect: () => remove(tile.id),
            },
          ]

      return [
        ...forTile,
        {
          id: 'add',
          label: 'Add a tile',
          icon: 'add',
          separatorBefore: forTile.length > 0,
          onSelect: () => setCreating({ kind: 'link' }),
        },
        {
          id: 'folder',
          label: 'New folder',
          icon: 'folder',
          onSelect: () => setCreating({ kind: 'folder' }),
        },
        ...(arrange.arranging
          ? []
          : [
              {
                id: 'arrange',
                label: 'Arrange',
                icon: 'drag' as const,
                separatorBefore: true,
                onSelect: arrange.start,
              },
            ]),
      ]
    },
    [items, remove, arrange],
  )

  const tileMenu = useContextMenu(buildMenu)

  // The resting grid, and the fallback until the drag chunk arrives; `null`
  // would blink the row away.
  const plainTiles = () =>
    visible.map((tile, index) => (
      <Tile
        key={tile.id}
        tile={tile}
        index={index}
        settings={tiles}
        showHint={shortcuts}
        childUrls={tile.kind === 'folder' ? childUrlsFor(tile.id) : undefined}
        onOpenFolder={setOpenFolder}
      />
    ))

  if (!tiles.enabled) return null

  const gridStyle = {
    '--tile-w': `${tiles.width}px`,
    // Icons are round, so the ratio is not the reader's to set here.
    '--tile-aspect': tiles.style === 'icon' ? 1 : tiles.aspect,
    '--tile-gap': `${tiles.gap}px`,
    '--tile-radius': tiles.radius === null ? 'var(--radius)' : `${tiles.radius}px`,
    '--tile-pad': `${tiles.imagePadding}px`,
    '--tile-fit': tiles.imageFit,
    // A column count fills the band with exactly that many tiles, expressed as a
    // percentage of the grid's own width so the count holds as the window
    // changes; zero means "as many as fit". The `max` stops the count dividing
    // the band past `--tile-min`, where `auto-fit` fits fewer per row instead.
    '--tile-track':
      tiles.columns === 0
        ? 'var(--tile-w)'
        : `max(var(--tile-min), calc((100% - ${tiles.gap * (tiles.columns - 1)}px) / ${tiles.columns}))`,
    '--tile-label-align': tiles.labelAlign,
  } as React.CSSProperties

  return (
    <div className="tiles-band" onContextMenu={tileMenu.onContextMenu}>
      <div
        className="tiles"
        ref={gridRef}
        data-label-vis={tiles.labelVisibility}
        data-hover={tiles.hoverEffect}
        data-plate={tiles.plateStyle}
        data-style={tiles.style}
        data-hints={hints}
        data-arranging={arrange.arranging}
        style={gridStyle}
      >
        {arrange.arranging ? (
          <Suspense fallback={plainTiles()}>
            <SortableTiles
              items={visible}
              settings={tiles}
              showHint={shortcuts}
              childUrlsFor={childUrlsFor}
              onReorder={(next) => write(reorderWithin(items, next))}
              onMoveToFolder={(tileId, folderId) => write(moveToFolder(items, tileId, folderId))}
              onOpenFolder={setOpenFolder}
            />
          </Suspense>
        ) : (
          plainTiles()
        )}

        {tiles.showAddButton ? (
          <button
            type="button"
            className="tile-add"
            title="Add a tile"
            aria-label="Add a tile"
            onClick={() => setCreating({ kind: 'link' })}
          >
            <Icon name="add" />
          </button>
        ) : null}
      </div>

      {/* The right-click menu is invisible, so an empty page has to say so. */}
      {visible.length === 0 ? (
        <button type="button" className="tiles-empty" onClick={() => setCreating({ kind: 'link' })}>
          <Icon name="add" />
          <span>Add a tile</span>
          <small>or right-click for more</small>
        </button>
      ) : null}

      {tiles.pages.length > 0 && tiles.pageSwitcher !== 'hidden' ? (
        <nav className="tiles-pages" data-style={tiles.pageSwitcher} aria-label="Tile pages">
          {pages.map((id, index) => (
            <button
              key={id}
              type="button"
              className="tiles-pages__item"
              aria-current={id === activePage}
              onClick={() => setPageId(id)}
              title={pageName(tiles.pages, id, index)}
            >
              <span>{pageName(tiles.pages, id, index)}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {tileMenu.menu}

      {openFolder ? (
        <Suspense fallback={null}>
          <FolderView
            folder={items.find((tile) => tile.id === openFolder) ?? null}
            items={items}
            settings={tiles}
            onReorder={(next) => write(reorderWithin(items, next))}
            onRemoveFromFolder={(id) => write(moveToFolder(items, id, ROOT))}
            onClose={() => setOpenFolder(null)}
          />
        </Suspense>
      ) : null}

      {editorId || creating ? (
        <Suspense fallback={null}>
          <TileEditor
            tile={items.find((t) => t.id === editorId) ?? null}
            initialKind={creating?.kind ?? 'link'}
            initialPageId={activePage}
            onClose={() => {
              setEditorId(null)
              setCreating(null)
            }}
            onSave={(tile) => {
              const exists = items.some((t) => t.id === tile.id)
              write(exists ? items.map((t) => (t.id === tile.id ? tile : t)) : [...items, tile])
              setEditorId(null)
              setCreating(null)
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
        </Suspense>
      ) : null}
    </div>
  )
}
