// AppiStream Music Search v5
// Uses saavn.dev format (returns direct CDN URLs, no decryption needed)
// Falls back to JioSaavn song detail API to get direct download links

const https = require('https')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com',
        'Cookie': 'L=telugu; gdpr_acceptance=true; DL=english',
      },
      timeout: 12000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')) })
  })
}

function d(s) {
  return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
}

// ── Get direct download URL for a song by ID ─────────────────────────────────
// JioSaavn's createAuthToken endpoint gives direct CDN links
async function getDirectUrl(songId, quality='_320') {
  try {
    // Approach 1: song detail with dl API
    const url = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=https://aac.saavncdn.com/${songId}${quality}.m4a&bitrates=320&__format=json&_marker=0&ctx=web6dot0`
    const { status, body } = await get(url)
    if (status === 200) {
      const j = JSON.parse(body)
      if (j?.auth_url) return j.auth_url
    }
  } catch(_) {}

  try {
    // Approach 2: song.getDetails gives media_url directly
    const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${songId}`
    const { status, body } = await get(url)
    if (status === 200) {
      const j = JSON.parse(body)
      const song = j?.[songId] || Object.values(j||{})[0]
      if (song?.media_url) return song.media_url
      if (song?.more_info?.encrypted_media_url) {
        // Decrypt: JioSaavn uses simple base64 + char swap
        return decryptJioSaavn(song.more_info.encrypted_media_url)
      }
    }
  } catch(_) {}
  return null
}

// JioSaavn URL decryption (DES ECB - simplified)
function decryptJioSaavn(enc) {
  try {
    // The encrypted_media_url is base64 with specific char substitutions
    const cleaned = enc.replace(/\//g, '_').replace(/\+/g, '-')
    const decoded = Buffer.from(cleaned, 'base64').toString('ascii')
    if (decoded.startsWith('http')) return decoded
    // Try direct base64
    const decoded2 = Buffer.from(enc, 'base64').toString('ascii')
    if (decoded2.startsWith('http')) return decoded2
  } catch(_) {}
  return null
}

// ── Parse songs from saavn.dev-style response ────────────────────────────────
function parseSongs(arr) {
  return arr.map(s => {
    const dlUrls = s.downloadUrl || []
    const best =
      dlUrls.find(u=>u.quality==='320kbps') ||
      dlUrls.find(u=>u.quality==='160kbps') ||
      dlUrls.find(u=>u.quality==='96kbps') ||
      dlUrls[0]

    const imgs = Array.isArray(s.image) ? s.image : []
    const img = (imgs.find(i=>i.quality==='500x500') || imgs.find(i=>i.quality==='150x150') || imgs[imgs.length-1])?.url || ''

    const artists = Array.isArray(s.artists?.primary)
      ? s.artists.primary.map(a=>a.name).join(', ')
      : (s.primaryArtists || s.artist || '')

    return {
      id: s.id,
      displayName: d(s.name || s.title || ''),
      url: best?.url || '',
      artist: d(artists),
      album: s.album?.name || s.album || '',
      image: img,
      duration: parseInt(s.duration || 0),
      language: (s.language || '').toLowerCase(),
      year: s.year || '',
      quality: best?.quality || '',
    }
  }).filter(s => s.displayName && s.url)
}

// ── Parse JioSaavn internal format + get direct URLs ────────────────────────
async function parseInternalAsync(arr, log) {
  const songs = []
  for (const s of arr.slice(0, 20)) {
    const mi = s.more_info || {}
    const title = d(s.title || s.song || '')
    if (!title) continue

    let url = null

    // Try media_url (sometimes direct)
    if (s.media_url && s.media_url.startsWith('http') && !s.media_url.includes('encrypted')) {
      url = s.media_url
    }

    // Try to decrypt encrypted_media_url
    if (!url && mi.encrypted_media_url) {
      url = decryptJioSaavn(mi.encrypted_media_url)
    }

    // Try media_preview_url (96kbps preview - still plays!)
    if (!url && s.media_preview_url) {
      url = s.media_preview_url
    }

    // Last resort: get direct URL via song detail API
    if (!url && s.id) {
      log.push(`Fetching direct URL for ${s.id}`)
      url = await getDirectUrl(s.id)
    }

    if (!url) { log.push(`Skip ${title}: no URL`); continue }

    const img = (s.image || '').replace('150x150','500x500').replace(/^http:/,'https:')
    songs.push({
      id: s.id,
      displayName: title,
      url,
      artist: d(mi.singers || s.primary_artists || ''),
      album: d(mi.album || ''),
      image: img,
      duration: parseInt(mi.duration || 0),
      language: (s.language || '').toLowerCase(),
      year: s.year || '',
    })
  }
  return songs
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' }

  const p = event.queryStringParameters || {}
  const query = (p.query || '').trim()
  const page  = Math.max(1, parseInt(p.page) || 1)
  const limit = Math.min(20, parseInt(p.limit) || 20)

  if (!query) return { statusCode:400, headers:CORS, body:JSON.stringify({error:'query required'}) }

  const log = [`q="${query}" p=${page}`]
  const t0 = Date.now()

  // ── API 1: saavn.dev  (best: returns direct CDN download URLs) ───────────
  try {
    const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`[1] saavn.dev`)
    const {status, body} = await get(url)
    log.push(`[1] HTTP ${status} ${body.length}b`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      log.push(`[1] raw:${raw.length}`)
      const songs = parseSongs(raw)
      log.push(`[1] playable:${songs.length}`)
      if (songs.length > 0) {
        return ok('saavn.dev', songs, j?.data?.total, log, t0)
      }
    }
  } catch(e) { log.push(`[1] ERR:${e.message}`) }

  // ── API 2: saavn.me ──────────────────────────────────────────────────────
  try {
    const url = `https://saavn.me/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`[2] saavn.me`)
    const {status, body} = await get(url)
    log.push(`[2] HTTP ${status} ${body.length}b`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      log.push(`[2] raw:${raw.length}`)
      const songs = parseSongs(raw)
      log.push(`[2] playable:${songs.length}`)
      if (songs.length > 0) {
        return ok('saavn.me', songs, null, log, t0)
      }
    }
  } catch(e) { log.push(`[2] ERR:${e.message}`) }

  // ── API 3: JioSaavn internal + song detail for direct URLs ───────────────
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`[3] jiosaavn.com internal`)
    const {status, body} = await get(url)
    log.push(`[3] HTTP ${status} ${body.length}b`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.results || []
      log.push(`[3] raw:${raw.length}`)
      const songs = await parseInternalAsync(raw, log)
      log.push(`[3] playable:${songs.length}`)
      if (songs.length > 0) {
        return ok('jiosaavn-internal', songs, parseInt(j.total)||songs.length, log, t0)
      }
    }
  } catch(e) { log.push(`[3] ERR:${e.message}`) }

  // ── API 4: jiosaavn-api vercel fork ─────────────────────────────────────
  try {
    const url = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`[4] vercel-fork`)
    const {status, body} = await get(url)
    log.push(`[4] HTTP ${status} ${body.length}b`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      const songs = parseSongs(raw)
      log.push(`[4] playable:${songs.length}`)
      if (songs.length > 0) return ok('vercel-fork', songs, null, log, t0)
    }
  } catch(e) { log.push(`[4] ERR:${e.message}`) }

  log.push(`ALL_FAILED ${Date.now()-t0}ms`)
  console.error('[music-search] all failed', log)
  return {
    statusCode: 502, headers: CORS,
    body: JSON.stringify({ success:false, error:'All music APIs failed', _log:log, _ms:Date.now()-t0 })
  }
}

function ok(source, songs, total, log, t0) {
  console.log(`[music-search] OK ${source} ${songs.length} songs ${Date.now()-t0}ms`)
  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({ success:true, source, data:{ results:songs, total:total||songs.length }, _log:log, _ms:Date.now()-t0 })
  }
}
