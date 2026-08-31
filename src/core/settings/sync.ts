import { isExtension, localStore } from '@/core/platform/browser'
import { Settings, type Settings as SettingsType } from './schema'

/**
 * Opt-in cross-device sync. `chrome.storage.sync` caps items at 8KB, the area at
 * 100KB and writes at 1,800/hour, so the blob is trimmed of device-local media
 * references, chunked per section, and its bookkeeping kept in `local` to avoid a
 * write loop.
 */

// Comfortably under the 8,192-byte per-item cap, leaving room for the key.
const CHUNK_BYTES = 7000
const META_KEY = 's:meta'
const BOOKKEEPING_KEY = 'syncState'

// Sections that travel. `widgets` carries notes and task text with it.
const SYNCED_SECTIONS = [
  'appearance',
  'layout',
  'tiles',
  'background',
  'widgets',
  'search',
  'behavior',
] as const

type SyncedSection = (typeof SYNCED_SECTIONS)[number]

interface SyncMeta {
  // Epoch ms of the push.
  at: number
  version: number
  chunks: Partial<Record<SyncedSection, number>>
  // Skipped because they exceeded the area quota.
  skipped: SyncedSection[]
}

export interface SyncState {
  lastPushedAt: number
  lastPulledAt: number
  // Auto-pull refuses a remote copy older than this, so offline edits survive.
  lastLocalChangeAt: number
  lastError: string
}

export const readSyncState = async (): Promise<SyncState> =>
  (await localStore.get<SyncState>(BOOKKEEPING_KEY)) ?? {
    lastPushedAt: 0,
    lastPulledAt: 0,
    lastLocalChangeAt: 0,
    lastError: '',
  }

const writeSyncState = (state: SyncState) => localStore.set(BOOKKEEPING_KEY, state)

export async function noteLocalChange(): Promise<void> {
  const state = await readSyncState()
  await writeSyncState({ ...state, lastLocalChangeAt: Date.now() })
}

/** Strips IndexedDB blob ids, which resolve to nothing on another device. Remote URLs travel. */
function trim(settings: SettingsType): Record<SyncedSection, unknown> {
  return {
    appearance: settings.appearance,
    layout: settings.layout,
    search: settings.search,
    behavior: settings.behavior,
    background: {
      ...settings.background,
      image: { ...settings.background.image, blobId: '' },
      video: { ...settings.background.video, blobId: '' },
      slideshow: { ...settings.background.slideshow, blobIds: [] },
    },
    tiles: {
      ...settings.tiles,
      items: settings.tiles.items.map((tile) =>
        tile.image.kind === 'upload'
          ? { ...tile, image: { ...tile.image, kind: 'auto' as const, blobId: '' } }
          : tile,
      ),
    },
    widgets: settings.widgets,
  }
}

export async function pushSettings(settings: SettingsType): Promise<SyncState> {
  const state = await readSyncState()
  if (!isExtension()) {
    return { ...state, lastError: 'Sync needs the extension environment.' }
  }

  const sections = trim(settings)
  const payload: Record<string, string | SyncMeta> = {}
  const chunks: SyncMeta['chunks'] = {}
  const skipped: SyncedSection[] = []
  let totalBytes = 0

  for (const section of SYNCED_SECTIONS) {
    const parts = split(JSON.stringify(sections[section]))
    const bytes = parts.reduce((sum, part) => sum + part.length + 16, 0)
    // Stop before the area quota rather than letting the write fail outright.
    if (totalBytes + bytes > 95_000) {
      skipped.push(section)
      continue
    }
    totalBytes += bytes
    chunks[section] = parts.length
    parts.forEach((part, index) => {
      payload[`s:${section}:${index}`] = part
    })
  }

  const meta: SyncMeta = { at: Date.now(), version: settings.version, chunks, skipped }
  payload[META_KEY] = meta

  try {
    // Clear first, or stale chunks from a larger previous push survive.
    await chrome.storage.sync.clear()
    await chrome.storage.sync.set(payload)
    const next: SyncState = {
      ...state,
      lastPushedAt: meta.at,
      lastLocalChangeAt: meta.at,
      lastError: skipped.length ? `Too large to sync: ${skipped.join(', ')}.` : '',
    }
    await writeSyncState(next)
    return next
  } catch (error) {
    const next = { ...state, lastError: describe(error) }
    await writeSyncState(next)
    return next
  }
}

const split = (text: string): string[] => {
  const parts: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_BYTES) parts.push(text.slice(i, i + CHUNK_BYTES))
  return parts.length > 0 ? parts : ['']
}

export interface PullResult {
  settings: SettingsType
  // When the pulled copy was pushed, for showing which side is newer.
  at: number
}

/** Returns null when nothing has ever been pushed, or the copy is unreadable. */
export async function pullSettings(current: SettingsType): Promise<PullResult | null> {
  if (!isExtension()) return null
  try {
    const stored = await chrome.storage.sync.get(null)
    const meta = stored[META_KEY] as SyncMeta | undefined
    if (!meta?.chunks) return null

    const merged: Record<string, unknown> = { version: current.version }
    for (const [section, count] of Object.entries(meta.chunks)) {
      let text = ''
      for (let i = 0; i < (count ?? 0); i += 1) text += (stored[`s:${section}:${i}`] as string) ?? ''
      if (!text) continue
      merged[section] = JSON.parse(text)
    }

    // Anything not pushed keeps this device's value; media references stay local.
    const candidate: SettingsType = {
      ...current,
      ...(merged as Partial<SettingsType>),
      background: {
        ...current.background,
        ...((merged.background as SettingsType['background']) ?? {}),
        image: current.background.image,
        video: current.background.video,
        slideshow: {
          ...current.background.slideshow,
          ...((merged.background as SettingsType['background'])?.slideshow ?? {}),
          blobIds: current.background.slideshow.blobIds,
        },
      },
    }

    const parsed = Settings.safeParse(candidate)
    if (!parsed.success) return null

    await writeSyncState({ ...(await readSyncState()), lastPulledAt: Date.now(), lastError: '' })
    return { settings: parsed.data, at: meta.at }
  } catch {
    return null
  }
}

/** Fires when another device pushes. */
export function subscribeSync(fn: () => void): () => void {
  if (!isExtension()) return () => undefined
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area === 'sync' && META_KEY in changes) fn()
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export async function clearSync(): Promise<void> {
  if (!isExtension()) return
  await chrome.storage.sync.clear()
  await writeSyncState({ lastPushedAt: 0, lastPulledAt: 0, lastLocalChangeAt: 0, lastError: '' })
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'Sync failed.'
