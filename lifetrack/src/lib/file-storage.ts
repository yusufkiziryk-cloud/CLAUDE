// File System Access API — stores all app data in a real .json file on disk.
// The file handle is persisted in a separate IDB so it survives page refreshes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandle = any

export const isSupported = () =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window

// ─── Handle persistence ───────────────────────────────────────

const H_DB = 'lt-file-handle-db'
const H_STORE = 'h'
const H_KEY = 'main'

let _hdb: IDBDatabase | null = null

async function handleDB(): Promise<IDBDatabase> {
  if (_hdb) return _hdb
  return new Promise((res, rej) => {
    const r = indexedDB.open(H_DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(H_STORE)
    r.onsuccess = () => { _hdb = r.result; res(r.result) }
    r.onerror = () => rej(r.error)
  })
}

export async function saveHandle(h: AnyHandle): Promise<void> {
  const db = await handleDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(H_STORE, 'readwrite')
    const req = tx.objectStore(H_STORE).put(h, H_KEY)
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

export async function loadHandle(): Promise<AnyHandle | null> {
  try {
    const db = await handleDB()
    return new Promise((res, rej) => {
      const tx = db.transaction(H_STORE, 'readonly')
      const req = tx.objectStore(H_STORE).get(H_KEY)
      req.onsuccess = () => res(req.result ?? null)
      req.onerror = () => rej(req.error)
    })
  } catch { return null }
}

export async function clearHandle(): Promise<void> {
  try {
    const db = await handleDB()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(H_STORE, 'readwrite')
      const req = tx.objectStore(H_STORE).delete(H_KEY)
      req.onsuccess = () => res()
      req.onerror = () => rej(req.error)
    })
  } catch { /* ignore */ }
}

// ─── Permission helpers ───────────────────────────────────────

export async function queryPermission(h: AnyHandle): Promise<PermissionState> {
  try { return await h.queryPermission({ mode: 'readwrite' }) }
  catch { return 'denied' }
}

export async function requestPermission(h: AnyHandle): Promise<boolean> {
  try { return (await h.requestPermission({ mode: 'readwrite' })) === 'granted' }
  catch { return false }
}

// ─── File I/O ─────────────────────────────────────────────────

export async function readFile(h: AnyHandle): Promise<string | null> {
  try {
    const file = await h.getFile()
    const text = await file.text()
    return text || null
  } catch { return null }
}

export async function writeFile(h: AnyHandle, content: string): Promise<boolean> {
  try {
    const w = await h.createWritable()
    await w.write(content)
    await w.close()
    return true
  } catch { return false }
}

// ─── File picker dialogs ──────────────────────────────────────

const FILE_TYPES = [{ description: 'LifeTrack Veri Dosyası', accept: { 'application/json': ['.json'] as `.${string}`[] } }]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any

export async function pickSaveFile(): Promise<AnyHandle | null> {
  try {
    const h = await win.showSaveFilePicker({ suggestedName: 'lifetrack-data.json', types: FILE_TYPES })
    await saveHandle(h)
    return h
  } catch { return null }
}

export async function pickOpenFile(): Promise<AnyHandle | null> {
  try {
    const [h] = await win.showOpenFilePicker({ types: FILE_TYPES, multiple: false })
    await saveHandle(h)
    return h
  } catch { return null }
}
