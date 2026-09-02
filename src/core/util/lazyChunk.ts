import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * `React.lazy`, hardened against an extension update under an open tab: chunk
 * names are content-hashed, so a new build leaves unfetched chunks unresolvable.
 * Reload once to pick up the new build; the session flag prevents a reload loop.
 */
const RELOAD_KEY = 'newtab:chunk-reload'

/** A lazy component that can also be fetched ahead of first render. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  /**
   * Fetches the chunk without rendering it. Safe to call repeatedly: the import
   * is cached after the first call, and a failure is left to the render path to
   * surface rather than becoming an unhandled rejection here.
   */
  preload: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyChunk<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
  // Shared by `lazy` and `preload`, so warming the chunk is what render then finds.
  let started: Promise<{ default: T }> | undefined
  const once = () => {
    started ??= (async () => {
      try {
        return await load()
      } catch (error) {
        if (!isStaleChunk(error) || alreadyReloaded()) throw error
        window.location.reload()
        // The page is on its way out; never resolve, so nothing renders meanwhile.
        return new Promise<{ default: T }>(() => {})
      }
    })()
    return started
  }

  const component = lazy(once) as PreloadableComponent<T>
  component.preload = () => {
    // Rejections belong to whoever renders it; swallow them on the warm path.
    void once().catch(() => {})
  }
  return component
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
