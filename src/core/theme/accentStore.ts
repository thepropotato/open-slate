/** The accent sampled from the current wallpaper, connecting the background and theme layers without either importing the other. */

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
