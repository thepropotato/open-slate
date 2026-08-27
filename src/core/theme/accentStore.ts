/**
 * Holds the accent colour sampled from the current wallpaper.
 *
 * The background layer is the only thing that knows which media is on screen,
 * and the theme layer is the only thing that knows how to paint tokens. This
 * one-value store connects them without either importing the other.
 */

let sampled: string | null = null
const listeners = new Set<() => void>()

export const accentStore = {
  get: (): string | null => sampled,
  set(value: string | null) {
    if (value === sampled) return
    sampled = value
    listeners.forEach((fn) => fn())
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
