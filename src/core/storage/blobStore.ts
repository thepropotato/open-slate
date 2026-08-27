/**
 * IndexedDB store for user media — wallpapers, videos and custom tile images.
 *
 * `chrome.storage` is the wrong home for these: it serialises to JSON and its
 * quotas are tuned for settings, not for a 40MB video. IndexedDB holds Blobs
 * natively and, with the `unlimitedStorage` permission, without a size cap.
 */

const DB_NAME = 'newtab-media'
const DB_VERSION = 1
const STORE = 'media'

export interface MediaRecord {
  id: string
  name: string
  type: string
  size: number
  width: number
  height: number
  addedAt: number
  blob: Blob
}

export type MediaMeta = Omit<MediaRecord, 'blob'>

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('addedAt', 'addedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Object URLs are cached per id so a re-render never creates a second one. */
const urlCache = new Map<string, string>()

export const mediaStore = {
  async put(record: Omit<MediaRecord, 'addedAt'>): Promise<string> {
    await transact('readwrite', (store) => store.put({ ...record, addedAt: Date.now() }))
    urlCache.delete(record.id)
    return record.id
  },

  async get(id: string): Promise<MediaRecord | undefined> {
    if (!id) return undefined
    return transact('readonly', (store) => store.get(id) as IDBRequest<MediaRecord | undefined>)
  },

  /** Resolves to a stable `blob:` URL, or null when the record is gone. */
  async url(id: string): Promise<string | null> {
    if (!id) return null
    const cached = urlCache.get(id)
    if (cached) return cached
    const record = await this.get(id)
    if (!record) return null
    const url = URL.createObjectURL(record.blob)
    urlCache.set(id, url)
    return url
  },

  async list(): Promise<MediaMeta[]> {
    const all = await transact('readonly', (store) => store.getAll() as IDBRequest<MediaRecord[]>)
    return all
      .map(({ blob: _blob, ...meta }) => meta)
      .sort((a, b) => b.addedAt - a.addedAt)
  },

  async remove(id: string): Promise<void> {
    await transact('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
    const url = urlCache.get(id)
    if (url) {
      URL.revokeObjectURL(url)
      urlCache.delete(id)
    }
  },

  async clear(): Promise<void> {
    await transact('readwrite', (store) => store.clear() as unknown as IDBRequest<undefined>)
    for (const url of urlCache.values()) URL.revokeObjectURL(url)
    urlCache.clear()
  },

  /** Bytes used / available, when the browser will tell us. */
  async usage(): Promise<{ used: number; quota: number } | null> {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { used: usage, quota }
  },
}

/** Reads intrinsic dimensions so the UI can show them and validate aspect. */
export async function measureMedia(file: File): Promise<{ width: number; height: number }> {
  if (file.type.startsWith('video/')) return measureVideo(file)
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return { width: 0, height: 0 }
  }
}

function measureVideo(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (width: number, height: number) => {
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight)
    video.onerror = () => done(0, 0)
    video.src = url
  })
}
