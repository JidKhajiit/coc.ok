import type { AppState } from '../types'

const DB_NAME = 'card-trades'
const DB_VERSION = 1
const STORE_NAME = 'event-states'

export type LocalEventState = {
  userId: string
  eventSlug: string
  data: AppState
  baseUpdatedAt: string | null
  localEditedAt: string
  dirty: boolean
}

function storageKey(userId: string, eventSlug: string) {
  return `${userId}::${eventSlug}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })
}

type StoredRow = LocalEventState & { key: string }

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      const request = fn(store)
      tx.oncomplete = () => resolve(request ? request.result : undefined)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      if (request) {
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
      }
    })
  } finally {
    db.close()
  }
}

export async function readLocalEventState(
  userId: string,
  eventSlug: string,
): Promise<LocalEventState | null> {
  try {
    const row = await withStore<StoredRow | undefined>('readonly', (store) =>
      store.get(storageKey(userId, eventSlug)),
    )
    if (!row) return null
    const { key: _key, ...rest } = row
    return rest
  } catch {
    return null
  }
}

export async function writeLocalEventState(entry: LocalEventState): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      const row: StoredRow = { key: storageKey(entry.userId, entry.eventSlug), ...entry }
      return store.put(row)
    })
  } catch {
    // Local persistence is best-effort; sync still attempts the server.
  }
}

export async function clearLocalEventState(userId: string, eventSlug: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(storageKey(userId, eventSlug)))
  } catch {
    // ignore
  }
}
