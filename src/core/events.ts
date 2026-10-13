/**
 * Page-wide custom event triggers to decouple top-level controls from deeply
 * nested canvas and grid components.
 */

export type AddTab = 'tile' | 'folder' | 'widget'

/** Opens the Add sheet. `pageId` is the tile page the new tile should land on. */
export function triggerAdd(tab: AddTab = 'tile', pageId = ''): void {
  window.dispatchEvent(new CustomEvent('open-slate:add', { detail: { tab, pageId } }))
}

export const triggerAddWidget = (): void => triggerAdd('widget')
export const triggerAddTile = (): void => triggerAdd('tile')
