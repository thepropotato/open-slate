export const CURSOR_KEY = 'slideshowCursor'

/** Which slide a freshly opened tab shows, when the wallpaper turns with the tab. */
export function pickForTab(stored: number | null, count: number, shuffle: boolean): number {
  if (count <= 1) return 0
  if (shuffle) return Math.floor(Math.random() * count)
  return ((stored ?? 0) + 1) % count
}

/** The slide after this one. Shuffled never repeats the one on screen. */
export function nextSlide(current: number, count: number, shuffle: boolean): number {
  if (count < 2) return 0
  if (!shuffle) return (current + 1) % count
  return (current + 1 + Math.floor(Math.random() * (count - 1))) % count
}
