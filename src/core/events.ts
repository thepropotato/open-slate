/**
 * Page-wide custom event triggers to decouple top-level controls from deeply
 * nested canvas and grid components.
 */

export function triggerAddWidget(): void {
  window.dispatchEvent(new CustomEvent('open-slate:add-widget'))
}

export function triggerAddTile(): void {
  window.dispatchEvent(new CustomEvent('open-slate:add-tile'))
}

