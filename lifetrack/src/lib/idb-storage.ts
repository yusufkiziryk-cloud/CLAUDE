// Persistent storage adapter for Zustand.
// Prefers IndexedDB (hundreds of MB, no practical limit) and transparently
// falls back to localStorage when IndexedDB is unavailable — e.g. some
// browsers block IndexedDB on the file:// protocol.

const DB_NAME = 'lifetrack-idb'
const STORE_NAME = 'kv'

let idbAvailable: boolean | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB yok'))
      return
    }
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch (e) {
      reject(e)
      return
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB engellendi'))
  })
}

// Probe IndexedDB once; cache the result.
async function checkIdb(): Promise<boolean> {
  if (idbAvailable !== null) return idbAvailable
  try {
    const db = await openDB()
    db.close()
    idbAvailable = true
  } catch {
    idbAvailable = false
  }
  return idbAvailable
}

function lsGet(name: string): string | null {
  try { return localStorage.getItem(name) } catch { return null }
}
function lsSet(name: string, value: string): void {
  try { localStorage.setItem(name, value) } catch (e) { console.error('localStorage yazma hatası', e) }
}
function lsRemove(name: string): void {
  try { localStorage.removeItem(name) } catch { /* ignore */ }
}

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (await checkIdb()) {
      try {
        const db = await openDB()
        const value = await new Promise<string | null>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const req = tx.objectStore(STORE_NAME).get(name)
          req.onsuccess = () => resolve((req.result as string) ?? null)
          req.onerror = () => reject(req.error)
        })
        db.close()
        // Migrate any pre-existing localStorage data on first read.
        if (value === null) {
          const legacy = lsGet(name)
          if (legacy !== null) return legacy
        }
        return value
      } catch {
        return lsGet(name)
      }
    }
    return lsGet(name)
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (await checkIdb()) {
      try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const req = tx.objectStore(STORE_NAME).put(value, name)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
        db.close()
        return
      } catch {
        lsSet(name, value)
        return
      }
    }
    lsSet(name, value)
  },

  removeItem: async (name: string): Promise<void> => {
    if (await checkIdb()) {
      try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const req = tx.objectStore(STORE_NAME).delete(name)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
        db.close()
      } catch { /* ignore */ }
    }
    lsRemove(name)
  },
}
