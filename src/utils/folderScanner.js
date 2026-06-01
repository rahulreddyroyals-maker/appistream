import { isMediaFile, buildTrackFromFile } from './helpers'
import {
  saveFileHandle, getAllFileHandles, deleteFileHandle, clearFileHandles,
  saveDirHandle, getAllDirHandles, clearDirHandles,
  saveAllTrackMeta, getAllTrackMeta, clearTrackMeta, deleteTrackMeta
} from './db'

// ── Walk directory recursively ────────────────────────────────────────────────
async function walkDir(dirHandle, results, onProgress, depth = 0) {
  if (depth > 12) return
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && isMediaFile(name)) {
        try {
          const file = await handle.getFile()
          const track = buildTrackFromFile(file)
          await saveFileHandle(track.id, handle)
          results.push(track)
          if (onProgress) onProgress(results.length, name)
        } catch(_) {}
      } else if (handle.kind === 'directory' && !name.startsWith('.')) {
        await walkDir(handle, results, onProgress, depth + 1)
      }
    }
  } catch(_) {}
}

// ── Open folder picker, scan, REPLACE library ─────────────────────────────────
// Always clears IDB first so no duplicates accumulate
export async function openFolderAndScan(onProgress) {
  if (!('showDirectoryPicker' in window)) return null
  let dirHandle
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' })
  } catch(e) {
    if (e.name === 'AbortError') return []
    throw e
  }

  // Clear ALL old data first — fresh scan
  await clearFileHandles()
  await clearDirHandles()
  await clearTrackMeta()

  // Save dir handle for re-scanning later
  await saveDirHandle(`dir_${Date.now()}`, dirHandle)

  const tracks = []
  await walkDir(dirHandle, tracks, onProgress)
  await saveAllTrackMeta(tracks)
  return tracks
}

// ── Add MORE files/folders WITHOUT clearing existing library ──────────────────
// Used when user adds extra files on top of existing library
export async function addFolderToLibrary(onProgress) {
  if (!('showDirectoryPicker' in window)) return null
  let dirHandle
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' })
  } catch(e) {
    if (e.name === 'AbortError') return []
    throw e
  }

  // Save this additional dir handle
  await saveDirHandle(`dir_${Date.now()}`, dirHandle)

  // Get existing IDs to avoid duplicates
  const existing = await getAllTrackMeta()
  const existingNames = new Set(existing.map(t => t.name))

  const tracks = []
  const rawTracks = []
  await walkDir(dirHandle, rawTracks, null)

  // Only add tracks not already in IDB (dedup by filename)
  for (const t of rawTracks) {
    if (!existingNames.has(t.name)) {
      tracks.push(t)
      if (onProgress) onProgress(tracks.length, t.name)
    }
  }

  if (tracks.length) await saveAllTrackMeta(tracks)
  return tracks
}

// ── Add individual files WITHOUT clearing ────────────────────────────────────
export async function addIndividualFiles(files) {
  const existing = await getAllTrackMeta()
  const existingNames = new Set(existing.map(t => t.name))
  const tracks = []
  for (const file of files) {
    if (!isMediaFile(file.name)) continue
    if (existingNames.has(file.name)) continue // skip duplicates
    const track = buildTrackFromFile(file)
    tracks.push(track)
  }
  if (tracks.length) await saveAllTrackMeta(tracks)
  return tracks
}

// ── Restore on app open (NO picker, NO duplicates) ───────────────────────────
export async function restoreLibrary(onProgress) {
  const meta = await getAllTrackMeta()
  if (!meta.length) return { tracks: [], needsPermission: false, totalSaved: 0 }

  const handles = await getAllFileHandles()
  const handleMap = new Map(handles.map(h => [h.id, h.handle]))

  // Deduplicate meta by name (in case IDB got duplicates from old versions)
  const seen = new Set()
  const uniqueMeta = meta.filter(m => {
    if (seen.has(m.name)) return false
    seen.add(m.name); return true
  })

  const tracks = []
  const needPermIds = []

  for (const m of uniqueMeta) {
    const handle = handleMap.get(m.id)
    if (!handle) { needPermIds.push(m.id); continue }
    try {
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm === 'granted') {
        const file = await handle.getFile()
        tracks.push({ ...m, url: URL.createObjectURL(file) })
        if (onProgress) onProgress(tracks.length, m.name)
      } else {
        needPermIds.push(m.id)
      }
    } catch(_) {
      await deleteFileHandle(m.id)
      await deleteTrackMeta(m.id)
    }
  }

  return {
    tracks,
    needsPermission: needPermIds.length > 0,
    totalSaved: uniqueMeta.length,
    loaded: tracks.length
  }
}

// ── Re-grant permission by re-scanning saved dirs (NO duplicates) ─────────────
export async function regrantAndRestore(onProgress) {
  const dirHandles = await getAllDirHandles()

  // Clear file handles — we'll re-populate them
  await clearFileHandles()
  // Keep track meta (names/types) so we can match

  const existing = await getAllTrackMeta()
  const existingNames = new Set(existing.map(t => t.name))
  const tracks = []

  for (const { handle } of dirHandles) {
    try {
      const perm = await handle.requestPermission({ mode: 'read' })
      if (perm === 'granted') {
        const raw = []
        await walkDir(handle, raw, null)
        // Only add if not already returned (dedup across multiple dir handles)
        for (const t of raw) {
          if (!tracks.find(x => x.name === t.name)) {
            tracks.push(t)
            if (onProgress) onProgress(tracks.length, t.name)
          }
        }
      }
    } catch(_) {}
  }

  // Also try individual file handles for files added outside a folder
  const fileHandles = await getAllFileHandles()
  for (const { id, handle } of fileHandles) {
    if (tracks.find(t => t.id === id)) continue
    try {
      const perm = await handle.requestPermission({ mode: 'read' })
      if (perm === 'granted') {
        const file = await handle.getFile()
        if (!tracks.find(t => t.name === file.name)) {
          const meta = existing.find(m => m.id === id)
          if (meta) tracks.push({ ...meta, url: URL.createObjectURL(file) })
        }
      }
    } catch(_) {}
  }

  // Save fresh metadata (replaces old)
  if (tracks.length) {
    await clearTrackMeta()
    await saveAllTrackMeta(tracks)
  }

  return tracks
}

// ── Standard file picker ─────────────────────────────────────────────────────
export function pickFiles() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*,video/*'
    input.multiple = true
    input.onchange = () => resolve(Array.from(input.files || []).filter(f => isMediaFile(f.name)))
    input.oncancel = () => resolve([])
    input.click()
  })
}

// ── Clear entire library ─────────────────────────────────────────────────────
export async function clearLibrary() {
  await clearFileHandles()
  await clearDirHandles()
  await clearTrackMeta()
}
