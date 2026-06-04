import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../lib/store'
import * as fs from '../lib/file-storage'

export type SyncStatus = 'unsupported' | 'checking' | 'no-file' | 'needs-permission' | 'connected' | 'error'

interface FileSyncState {
  status: SyncStatus
  fileName: string
  lastSaved: Date | null
}

// Serialize store state for writing to file (functions are auto-skipped by JSON.stringify)
function serializeState() {
  const state = useStore.getState()
  return JSON.stringify({ state, version: 0 }, (_k, v) => typeof v === 'function' ? undefined : v)
}

// Module-level handle + unsubscribe so we don't lose them between renders
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeHandle: any | null = null
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()
let sharedStatus: SyncStatus = 'checking'
let sharedFileName = ''
let sharedLastSaved: Date | null = null

function notifyListeners() {
  listeners.forEach(fn => fn())
}

function attachSubscription(h: FileSystemFileHandle, onSaved: () => void) {
  if (unsubscribe) unsubscribe()
  let timer: ReturnType<typeof setTimeout>
  unsubscribe = useStore.subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const ok = await fs.writeFile(h, serializeState())
      if (ok) { sharedLastSaved = new Date(); onSaved() }
    }, 1500)
  })
}

// ─── Main hook ────────────────────────────────────────────────

export function useFileSync() {
  const [, forceRender] = useState(0)
  const onSaved = useCallback(() => { forceRender(n => n + 1) }, [])

  // Register as listener for module-level state updates
  useEffect(() => {
    const fn = () => forceRender(n => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  // Initialize once on first mount of any consumer
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (!fs.isSupported()) {
      sharedStatus = 'unsupported'
      notifyListeners()
      return
    }

    async function init() {
      const h = await fs.loadHandle()
      if (!h) {
        sharedStatus = 'no-file'
        notifyListeners()
        return
      }

      const perm = await fs.queryPermission(h)
      sharedFileName = h.name
      activeHandle = h

      if (perm === 'granted') {
        await loadFromFile(h)
        attachSubscription(h, onSaved)
        sharedStatus = 'connected'
      } else {
        sharedStatus = 'needs-permission'
      }
      notifyListeners()
    }
    init()
  }, [onSaved])

  // ─── Actions ─────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!activeHandle) return
    const granted = await fs.requestPermission(activeHandle)
    if (!granted) { sharedStatus = 'error'; notifyListeners(); return }
    await loadFromFile(activeHandle)
    attachSubscription(activeHandle, onSaved)
    sharedStatus = 'connected'
    notifyListeners()
  }, [onSaved])

  const setupNew = useCallback(async () => {
    const h = await fs.pickSaveFile()
    if (!h) return
    // Write current state to newly created file
    await fs.writeFile(h, serializeState())
    sharedLastSaved = new Date()
    activeHandle = h
    sharedFileName = h.name
    attachSubscription(h, onSaved)
    sharedStatus = 'connected'
    notifyListeners()
  }, [onSaved])

  const setupExisting = useCallback(async () => {
    const h = await fs.pickOpenFile()
    if (!h) return
    const granted = await fs.requestPermission(h)
    if (!granted) return
    await loadFromFile(h)
    activeHandle = h
    sharedFileName = h.name
    attachSubscription(h, onSaved)
    sharedStatus = 'connected'
    notifyListeners()
  }, [onSaved])

  const disconnect = useCallback(async () => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    activeHandle = null
    sharedFileName = ''
    sharedLastSaved = null
    await fs.clearHandle()
    sharedStatus = 'no-file'
    notifyListeners()
  }, [])

  const saveNow = useCallback(async () => {
    if (!activeHandle) return
    const ok = await fs.writeFile(activeHandle, serializeState())
    if (ok) { sharedLastSaved = new Date(); forceRender(n => n + 1) }
  }, [])

  return {
    status: sharedStatus,
    fileName: sharedFileName,
    lastSaved: sharedLastSaved,
    connect,
    setupNew,
    setupExisting,
    disconnect,
    saveNow,
  }
}

// ─── Helper ───────────────────────────────────────────────────

async function loadFromFile(h: FileSystemFileHandle) {
  const text = await fs.readFile(h)
  if (!text) return
  try {
    const parsed = JSON.parse(text) as { state?: Record<string, unknown> }
    if (parsed?.state && typeof parsed.state === 'object') {
      // Shallow merge — preserves store action functions
      useStore.setState(parsed.state as Parameters<typeof useStore.setState>[0])
    }
  } catch { /* malformed file, ignore */ }
}
