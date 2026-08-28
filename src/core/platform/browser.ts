/**
 * Thin abstraction over the `chrome.*` APIs.
 *
 * Everything the app touches goes through here so that (a) the UI can run in a
 * plain `vite dev` browser tab with localStorage/in-memory fallbacks, and
 * (b) each capability has exactly one place that knows whether it is available.
 */

type AnyRecord = Record<string, unknown>

export const isExtension = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.runtime?.id

export type StorageArea = 'local' | 'sync'

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  /** Fires when `key` changes, including changes made by other open tabs. */
  subscribe(key: string, fn: (value: unknown) => void): () => void
}

function chromeStore(area: StorageArea): KeyValueStore {
  const bucket = () => chrome.storage[area]
  return {
    async get(key) {
      const res = (await bucket().get(key)) as AnyRecord
      return res[key] as never
    },
    async set(key, value) {
      await bucket().set({ [key]: value })
    },
    async remove(key) {
      await bucket().remove(key)
    },
    subscribe(key, fn) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        changedArea: string,
      ) => {
        if (changedArea !== area) return
        if (key in changes) fn(changes[key].newValue)
      }
      chrome.storage.onChanged.addListener(handler)
      return () => chrome.storage.onChanged.removeListener(handler)
    },
  }
}

/**
 * localStorage-backed stand-in used when running outside the extension.
 *
 * Nothing here touches `window` at import time: the cross-tab listener is
 * attached on first subscribe. That keeps this module importable from plain Node,
 * which is what lets the self-test exercise the pure logic that depends on it.
 */
function webStore(area: StorageArea): KeyValueStore {
  const prefix = `newtab:${area}:`
  const listeners = new Map<string, Set<(v: unknown) => void>>()
  let listening = false

  const emit = (key: string, value: unknown) =>
    listeners.get(key)?.forEach((fn) => fn(value))

  const startListening = () => {
    if (listening || typeof window === 'undefined') return
    listening = true
    window.addEventListener('storage', (event) => {
      if (!event.key?.startsWith(prefix)) return
      const key = event.key.slice(prefix.length)
      emit(key, event.newValue === null ? undefined : JSON.parse(event.newValue))
    })
  }

  return {
    async get(key) {
      if (typeof localStorage === 'undefined') return undefined
      const raw = localStorage.getItem(prefix + key)
      return raw === null ? undefined : (JSON.parse(raw) as never)
    },
    async set(key, value) {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(prefix + key, JSON.stringify(value))
      emit(key, value)
    },
    async remove(key) {
      if (typeof localStorage === 'undefined') return
      localStorage.removeItem(prefix + key)
      emit(key, undefined)
    },
    subscribe(key, fn) {
      startListening()
      const set = listeners.get(key) ?? new Set()
      listeners.set(key, set)
      set.add(fn)
      return () => set.delete(fn)
    },
  }
}

const makeStore = (area: StorageArea) =>
  isExtension() ? chromeStore(area) : webStore(area)

/** Settings live here. `local` avoids the 8KB-per-item `sync` quota. */
export const localStore = makeStore('local')
/** Reserved for the opt-in cross-device sync of a trimmed settings subset. */
export const syncStore = makeStore('sync')

/* ------------------------------------------------------------------ favicons */

/**
 * Chrome's `_favicon` endpoint reads the browser's own favicon cache, so it
 * needs no network request and leaks nothing. Outside the extension we fall
 * back to Google's public favicon service.
 */
export function faviconUrl(pageUrl: string, size = 64): string {
  if (isExtension()) {
    const url = new URL(chrome.runtime.getURL('/_favicon/'))
    url.searchParams.set('pageUrl', pageUrl)
    url.searchParams.set('size', String(size))
    return url.toString()
  }
  try {
    const { hostname } = new URL(pageUrl)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`
  } catch {
    return ''
  }
}

/* --------------------------------------------------------------- permissions */

export type OptionalPermission =
  | 'sessions'
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'tabs'

export const permissions = {
  async has(names: OptionalPermission[], origins: string[] = []): Promise<boolean> {
    if (!isExtension()) return true
    return chrome.permissions.contains({ permissions: names, origins })
  },
  async request(names: OptionalPermission[], origins: string[] = []): Promise<boolean> {
    if (!isExtension()) return true
    return chrome.permissions.request({ permissions: names, origins })
  },
  async drop(names: OptionalPermission[], origins: string[] = []): Promise<boolean> {
    if (!isExtension()) return true
    return chrome.permissions.remove({ permissions: names, origins })
  },
}

/* ------------------------------------------------------------------ commands */

export function openUrl(url: string, where: 'current' | 'newTab' = 'current') {
  if (where === 'newTab') {
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.assign(url)
  }
}

export function openOptions() {
  if (isExtension()) chrome.runtime.openOptionsPage()
  else window.location.assign('/options.html')
}
