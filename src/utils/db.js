import { openDB } from 'idb'

const DB = 'appistream-v5'
const VER = 1
let _db = null

async function db() {
  if (!_db) _db = await openDB(DB, VER, {
    upgrade(db) {
      db.createObjectStore('fileHandles', { keyPath: 'id' })
      db.createObjectStore('trackMeta',   { keyPath: 'id' })
      db.createObjectStore('playlists',   { keyPath: 'id' })
      db.createObjectStore('favorites',   { keyPath: 'id' })
      db.createObjectStore('history',     { keyPath: 'hid' })
      db.createObjectStore('settings',    { keyPath: 'key' })
      db.createObjectStore('eq',          { keyPath: 'key' })
      // Store directory handles separately
      db.createObjectStore('dirHandles',  { keyPath: 'id' })
      db.createObjectStore('lyrics',       { keyPath: 'trackId' })
    }
  })
  return _db
}

// ── FileSystem Handles ────────────────────────────────────────────────────────
export async function saveFileHandle(id, handle) {
  try { await (await db()).put('fileHandles', { id, handle }) } catch(_) {}
}
export async function getAllFileHandles() {
  try { return await (await db()).getAll('fileHandles') } catch(_) { return [] }
}
export async function deleteFileHandle(id) {
  try { await (await db()).delete('fileHandles', id) } catch(_) {}
}
export async function clearFileHandles() {
  try { await (await db()).clear('fileHandles') } catch(_) {}
}

// ── Directory handles (persist scanned folders) ───────────────────────────────
export async function saveDirHandle(id, handle) {
  try { await (await db()).put('dirHandles', { id, handle, savedAt: Date.now() }) } catch(_) {}
}
export async function getAllDirHandles() {
  try { return await (await db()).getAll('dirHandles') } catch(_) { return [] }
}
export async function clearDirHandles() {
  try { await (await db()).clear('dirHandles') } catch(_) {}
}

// ── Track metadata (everything except blob URL) ───────────────────────────────
export async function saveTrackMeta(track) {
  try { const { url, ...meta } = track; await (await db()).put('trackMeta', meta) } catch(_) {}
}
export async function saveAllTrackMeta(tracks) {
  try {
    const d = await db(); const tx = d.transaction('trackMeta', 'readwrite')
    await Promise.all(tracks.map(t => { const { url, ...m } = t; return tx.store.put(m) }))
    await tx.done
  } catch(_) {}
}
export async function getAllTrackMeta() {
  try { return await (await db()).getAll('trackMeta') } catch(_) { return [] }
}
export async function clearTrackMeta() {
  try { await (await db()).clear('trackMeta') } catch(_) {}
}
export async function deleteTrackMeta(id) {
  try { await (await db()).delete('trackMeta', id) } catch(_) {}
}

// ── Playlists ─────────────────────────────────────────────────────────────────
export async function getPlaylists() { try { return await (await db()).getAll('playlists') } catch(_) { return [] } }
export async function savePlaylist(pl) { try { await (await db()).put('playlists', pl) } catch(_) {} }
export async function deletePlaylist(id) { try { await (await db()).delete('playlists', id) } catch(_) {} }

// ── Favorites ─────────────────────────────────────────────────────────────────
export async function getFavorites() { try { return await (await db()).getAll('favorites') } catch(_) { return [] } }
export async function addFavorite(track) {
  try { const { url, ...m } = track; await (await db()).put('favorites', { ...m, favAt: Date.now() }) } catch(_) {}
}
export async function removeFavorite(id) { try { await (await db()).delete('favorites', id) } catch(_) {} }
export async function isFavorite(id) { try { return !!(await (await db()).get('favorites', id)) } catch(_) { return false } }

// ── History ───────────────────────────────────────────────────────────────────
export async function addToHistory(track) {
  try {
    const d = await db(); const { url, ...m } = track
    const hid = `${track.id}_${Date.now()}`
    await d.put('history', { ...m, hid, playedAt: Date.now() })
    const all = await d.getAll('history')
    if (all.length > 500) {
      const old = all.sort((a,b) => a.playedAt-b.playedAt)[0]
      await d.delete('history', old.hid)
    }
  } catch(_) {}
}
export async function getHistory() {
  try { const all = await (await db()).getAll('history'); return all.sort((a,b) => b.playedAt-a.playedAt) } catch(_) { return [] }
}
export async function clearHistory() { try { await (await db()).clear('history') } catch(_) {} }

// ── Settings ──────────────────────────────────────────────────────────────────
export async function getSetting(key, fallback) {
  try { const r = await (await db()).get('settings', key); return r ? r.value : fallback } catch(_) { return fallback }
}
export async function setSetting(key, value) {
  try { await (await db()).put('settings', { key, value }) } catch(_) {}
}
export async function getEQSettings() {
  try { const r = await (await db()).get('eq', 'bands'); return r?.value||null } catch(_) { return null }
}
export async function saveEQSettings(bands) {
  try { await (await db()).put('eq', { key:'bands', value:bands }) } catch(_) {}
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
export async function getLyrics(trackId) {
  try { const r = await (await db()).get('lyrics', trackId); return r || null } catch(_) { return null }
}
export async function saveLyrics(trackId, text, title = '') {
  try { await (await db()).put('lyrics', { trackId, text, title, updatedAt: Date.now() }) } catch(_) {}
}
export async function deleteLyrics(trackId) {
  try { await (await db()).delete('lyrics', trackId) } catch(_) {}
}
export async function getAllLyrics() {
  try { return await (await db()).getAll('lyrics') } catch(_) { return [] }
}
