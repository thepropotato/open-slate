import type { Tile, TilePage } from '@/core/settings/schema'

/**
 * Reading the flat tile list as pages and folders.
 *
 * Everything here is derived, never stored: the only stored relationships are
 * each tile's `parentId` and `pageId`. That keeps a move between folders a
 * one-field change and makes an orphaned reference impossible to persist —
 * a tile whose parent has been deleted simply reads as a root tile again.
 */

export const ROOT = ''

/** The page a tile belongs to, treating anything unknown as the first page. */
export function tilePage(tile: Tile, pages: TilePage[]): string {
  if (!tile.pageId) return ROOT
  return pages.some((page) => page.id === tile.pageId) ? tile.pageId : ROOT
}

/** The parent a tile belongs to, treating a deleted folder as the root. */
export function tileParent(tile: Tile, items: Tile[]): string {
  if (!tile.parentId) return ROOT
  const parent = items.find((candidate) => candidate.id === tile.parentId)
  return parent?.kind === 'folder' ? tile.parentId : ROOT
}

export function tilesIn(items: Tile[], pages: TilePage[], pageId: string, parentId: string): Tile[] {
  return items.filter(
    // A folder's contents are shown regardless of which page the folder is on,
    // so moving a folder never strands the tiles inside it.
    (tile) =>
      tileParent(tile, items) === parentId &&
      (parentId !== ROOT || tilePage(tile, pages) === pageId),
  )
}

export const folderChildren = (items: Tile[], folderId: string): Tile[] =>
  items.filter((tile) => tileParent(tile, items) === folderId)

export const foldersIn = (items: Tile[]): Tile[] => items.filter((tile) => tile.kind === 'folder')

/**
 * Deleting a folder promotes its contents to the folder's own page rather than
 * deleting them: losing a group of links to one misclick would be unforgiving.
 */
export function removeTile(items: Tile[], id: string): Tile[] {
  const target = items.find((tile) => tile.id === id)
  if (!target) return items
  return items
    .filter((tile) => tile.id !== id)
    .map((tile) =>
      tile.parentId === id ? { ...tile, parentId: ROOT, pageId: target.pageId } : tile,
    )
}

/** Page ids in display order, with the implicit first page included. */
export const pageIds = (pages: TilePage[]): string[] => [ROOT, ...pages.map((page) => page.id)]

export function pageName(pages: TilePage[], id: string, index: number): string {
  if (id === ROOT) return pages.length > 0 ? 'Main' : ''
  const page = pages.find((candidate) => candidate.id === id)
  return page?.name?.trim() || `Page ${index + 1}`
}

/**
 * Applies a new order to a subset of the list, in place.
 *
 * Display order is the array order, so reordering the contents of one folder
 * means writing the new sequence back into the positions that subset already
 * occupied — leaving every other tile exactly where it was.
 */
export function reorderWithin(items: Tile[], next: Tile[]): Tile[] {
  const ids = new Set(next.map((tile) => tile.id))
  const queue = [...next]
  return items.map((tile) => (ids.has(tile.id) ? (queue.shift() ?? tile) : tile))
}

/** Moves a tile into a folder, or back out to a page when `folderId` is empty. */
export function moveToFolder(items: Tile[], tileId: string, folderId: string): Tile[] {
  const folder = items.find((tile) => tile.id === folderId)
  return items.map((tile) => {
    if (tile.id !== tileId) return tile
    // Folders do not nest: one level keeps the interaction predictable.
    if (tile.kind === 'folder') return tile
    return { ...tile, parentId: folderId, pageId: folder ? folder.pageId : tile.pageId }
  })
}
