/** Which slide a freshly opened tab shows, when the wallpaper turns with the tab. */
export function pickForTab(stored: number | null, count: number, shuffle: boolean): number {
  if (count <= 1) return 0
  if (shuffle) return Math.floor(Math.random() * count)
  return ((stored ?? 0) + 1) % count
}
