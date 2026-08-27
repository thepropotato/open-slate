import { lazy, type ComponentType } from 'react'

/**
 * `React.lazy`, hardened against an extension update under an open tab.
 *
 * Chunk filenames are content-hashed, so when Chrome swaps in a new build the
 * old file names stop resolving and every chunk that had not been fetched yet
 * rejects with "Failed to fetch dynamically imported module". The tab is then
 * left with a feature that can never load, and the rejection surfaces as an
 * uncaught error. A reload picks up the new build; the session flag makes sure
 * a genuinely missing chunk cannot turn that into a reload loop.
 */
const RELOAD_KEY = 'newtab:chunk-reload'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyChunk<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await load()
    } catch (error) {
      if (!isStaleChunk(error) || alreadyReloaded()) throw error
      window.location.reload()
      // The page is on its way out; never resolve, so nothing renders meanwhile.
      return new Promise<{ default: T }>(() => {})
    }
  })
}

const isStaleChunk = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed/i.test(message)
}

/** Records the attempt, and reports whether one has already been made. */
function alreadyReloaded(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return true
    sessionStorage.setItem(RELOAD_KEY, '1')
    return false
  } catch {
    // Storage can be unavailable; without a way to count, never reload.
    return true
  }
}
