// IndexedDB storage adapter for Zustand persist.
// Uses a single persistent DB connection (never closed) so rapid consecutive
// writes don't race against each other. Falls back to localStorage silently
// when IndexedDB is blocked (e.g. file:// in some browsers).

const DB_NAME = 'lifetrack-idb'
const STORE_NAME = 'kv'

// Singleton promise — open once, reuse forever.
let _db: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return }
    let req: IDBOpenDBRequest
    try { req = indexedDB.open(DB_NAME, 1) } catch (e) { reject(e); return }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { _db = null; reject(req.error) }
    req.onblocked = () => { _db = null; reject(new Error('idb-blocked')) }
  })
  _db.catch(() => { _db = null })
  return _db
}

// --- localStorage helpers (fallback) ---
function lsGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch (e) {
    // Quota exceeded — try to clear large attachment data then retry
    try {
      const keys = Object.keys(localStorage)
      // Remove any old backups or oversized items, keep the store key
      keys.filter(x => x !== k && x !== 'lifetrack-store').forEach(x => localStorage.removeItem(x))
      localStorage.setItem(k, v)
    } catch { /* give up */ }
  }
}
function lsRemove(k: string) { try { localStorage.removeItem(k) } catch { /* ignore */ } }

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getDB()
      return await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(name)
        req.onsuccess = () => resolve((req.result as string) ?? null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return lsGet(name)
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    // Write to both so recovery is possible if one fails
    lsSet(name, value)
    try {
      const db = await getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).put(value, name)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch { /* localStorage write already done above */ }
  },

  removeItem: async (name: string): Promise<void> => {
    lsRemove(name)
    try {
      const db = await getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).delete(name)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch { /* ignore */ }
  },
}
