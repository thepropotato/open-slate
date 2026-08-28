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
import './tiles.css'

/** On demand: the editor carries the brand picker and the media store. */
const TileEditor = lazyChunk(() => import('./TileEditor').then((m) => ({ default: m.TileEditor })))

/** On demand: the drag library is only needed once Arrange mode is entered. */
const SortableTiles = lazyChunk(() =>
  import('./SortableTiles').then((m) => ({ default: m.SortableTiles })),
)

const FolderView = lazyChunk(() => import('./FolderView').then((m) => ({ default: m.FolderView })))

/**
 * The speed dial band.
 *
 * Reordering is opt-in via Arrange mode rather than always-on drag, so a single
 * click on a tile always navigates — the common case by far. Pages and folders
 * are both derived from the flat tile list; see `folders.ts`.
 */
export function TileGrid() {
  const { tiles, behavior } = useSettings()
  const { update } = useSettingsActions()
  const [editing, setEditing] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ kind: 'link' | 'folder' } | null>(null)
  const [hints, setHints] = useState(false)
  const [pageId, setPageId] = useState<string>(ROOT)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useGridArrows(gridRef, 'a.tile__plate, button.tile__plate')

  const items = tiles.items
  const pages = useMemo(() => pageIds(tiles.pages), [tiles.pages])

  // Derived rather than corrected in an effect: if the selected page has since
  // been deleted, fall back to the first one without an extra render.
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

  const remove = (id: string) => write(removeTile(items, id))

  /** The tiles without any drag plumbing: the normal path, and the Arrange fallback. */
  const plainTiles = (arranging: boolean) =>
    visible.map((tile, index) => (
      <Tile
        key={tile.id}
        tile={tile}
        index={index}
        settings={tiles}
        editing={arranging}
        showHint={shortcuts}
        childUrls={tile.kind === 'folder' ? childUrlsFor(tile.id) : undefined}
        onOpenFolder={setOpenFolder}
        onEdit={setEditorId}
        onRemove={remove}
      />
    ))

  if (!tiles.enabled) return null

  const gridStyle = {
    '--tile-w': `${tiles.width}px`,
    '--tile-aspect': tiles.aspect,
    '--tile-gap': `${tiles.gap}px`,
    '--tile-radius': tiles.radius === null ? 'var(--radius)' : `${tiles.radius}px`,
    '--tile-pad': `${tiles.imagePadding}px`,
    '--tile-fit': tiles.imageFit,
    /*
     * A column count means a row of exactly that many tiles filling the band,
     * so the grid ends where the widget canvas above it does — the same deal
     * the widget grid makes, where the column count is the only size control.
     * The share is a percentage of the grid's own width, which is what keeps
     * the fitted count at exactly `columns` as the window changes. Zero
     * columns is "as many as fit", where the tile width sets the track.
     *
     * The `max` is what keeps that count from dividing the band indefinitely.
     * Five columns across 360px is a 53px plate whose label truncates to
     * "g...", and a speed dial you cannot read is not one you can use. Once the
     * share drops under `--tile-min` the track holds there and `auto-fit` fits
     * fewer per row instead — so the count is honoured wherever there is room
     * for it, and gives way before the tiles stop being legible.
     */
    '--tile-track':
      tiles.columns === 0
        ? 'var(--tile-w)'
        : `max(var(--tile-min), calc((100% - ${tiles.gap * (tiles.columns - 1)}px) / ${tiles.columns}))`,
    '--tile-label-align': tiles.labelAlign,
  } as React.CSSProperties

  return (
    <div className="tiles-band">
      <div
        className="tiles"
        ref={gridRef}
        data-label-vis={tiles.labelVisibility}
        data-hover={tiles.hoverEffect}
        data-plate={tiles.plateStyle}
        data-hints={hints}
        style={gridStyle}
      >
        {editing ? (
          /*
           * The fallback is the same band of tiles, frozen: swapping in `null`
           * while the drag chunk loads would blink the whole row away and leave
           * the add button alone on the line for a frame or two.
           */
          <Suspense fallback={plainTiles(true)}>
            <SortableTiles
              items={visible}
              settings={tiles}
              showHint={shortcuts}
              childUrlsFor={childUrlsFor}
              onReorder={(next) => write(reorderWithin(items, next))}
              onMoveToFolder={(tileId, folderId) => write(moveToFolder(items, tileId, folderId))}
              onOpenFolder={setOpenFolder}
              onEdit={setEditorId}
              onRemove={remove}
            />
          </Suspense>
        ) : (
          plainTiles(false)
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

      <div className="tiles-band__toolbar">
        <button
          type="button"
          className="tiles-band__toggle"
          aria-pressed={editing}
          onClick={() => setEditing((on) => !on)}
          title={editing ? 'Done arranging' : 'Arrange tiles, and drag one onto a folder to file it'}
        >
          <Icon name={editing ? 'check' : 'drag'} />
          <span>{editing ? 'Done' : 'Arrange'}</span>
        </button>
        {editing ? (
          <button
            type="button"
            className="tiles-band__toggle"
            onClick={() => setCreating({ kind: 'folder' })}
            title="Add a folder"
          >
            <Icon name="folder" />
            <span>Folder</span>
          </button>
        ) : null}
      </div>

      {openFolder ? (
        <Suspense fallback={null}>
          <FolderView
            folder={items.find((tile) => tile.id === openFolder) ?? null}
            items={items}
            settings={tiles}
            editing={editing}
            onReorder={(next) => write(reorderWithin(items, next))}
            onRemoveFromFolder={(id) => write(moveToFolder(items, id, ROOT))}
            onEdit={(id) => {
              setOpenFolder(null)
              setEditorId(id)
            }}
            onRemove={remove}
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
