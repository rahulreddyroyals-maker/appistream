// AppiStream Music Search — Netlify Function v3
// Uses JioSaavn + multiple fallbacks with full debug logging

const https = require('https')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

// Simple HTTPS GET using built-in Node.js module
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9,te;q=0.8',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com',
      },
      timeout: 15000,
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => resolve({ status: res.statusCode, raw, headers: res.headers }))
    })
    req.on('error', e => reject(e))
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout after 15s')) })
  })
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
}

function bestImg(url) {
  return (url || '').replace('150x150','500x500').replace('50x50','500x500').replace(/^http:/,'https:')
}

// ── Parser for JioSaavn internal API ─────────────────────────────────────────
function parseInternal(results) {
  return results.map(s => {
    const mi = s.more_info || {}
    // The encrypted_media_url is base64 encoded - try to get preview instead
    const previewUrl = s.media_preview_url || ''
    // For full tracks, use encrypted URL (needs client-side decryption)
    const encUrl = mi.encrypted_media_url || ''
    // Try to get a playable URL
    const playUrl = previewUrl || encUrl
    return {
      id: s.id,
      displayName: decode(s.title || s.song || ''),
      url: playUrl,
      previewUrl,
      encryptedUrl: encUrl,
      artist: decode(mi.singers || s.primary_artists || s.subtitle || ''),
      album: decode(mi.album || ''),
      image: bestImg(s.image || ''),
      duration: parseInt(mi.duration || s.duration || 0),
      language: (s.language || '').toLowerCase(),
      year: s.year || '',
      is320: mi['320kbps'] === 'true',
    }
  }).filter(s => s.displayName && s.url)
}

// ── Parser for saavn.dev / saavn.me format ────────────────────────────────────
function parseSaavnDev(results) {
  return results.map(s => {
    const dlUrls = s.downloadUrl || []
    const best = dlUrls.find(u=>u.quality==='320kbps')
      || dlUrls.find(u=>u.quality==='160kbps')
      || dlUrls.find(u=>u.quality==='96kbps')
      || dlUrls[0]
    const imgs = Array.isArray(s.image) ? s.image : []
    const img = (imgs.find(i=>i.quality==='500x500') || imgs.find(i=>i.quality==='150x150') || imgs[0])?.url || ''
    const artists = Array.isArray(s.artists?.primary)
      ? s.artists.primary.map(a=>a.name).join(', ')
      : (s.primaryArtists || s.artists || '')
    return {
      id: s.id,
      displayName: s.name || s.title || '',
      url: best?.url || '',
      artist: decode(artists),
      album: s.album?.name || s.album || '',
      image: img,
      duration: parseInt(s.duration || 0),
      language: (s.language || '').toLowerCase(),
      year: s.year || '',
    }
  }).filter(s => s.displayName && s.url)
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' }

  const p = event.queryStringParameters || {}
  const query = (p.query || '').trim()
  const page  = Math.max(1, parseInt(p.page) || 1)
  const limit = Math.min(30, parseInt(p.limit) || 20)

  if (!query) return { statusCode:400, headers:CORS, body:JSON.stringify({error:'query required'}) }

  const log = []
  const ts = Date.now()
  log.push(`query="${query}" page=${page} limit=${limit}`)

  // ── 1. saavn.dev ────────────────────────────────────────────────────────────
  try {
    const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`Trying saavn.dev: ${url}`)
    const { status, raw } = await get(url)
    log.push(`saavn.dev status: ${status}, bytes: ${raw.length}`)
    if (status === 200) {
      const data = JSON.parse(raw)
      const results = data?.data?.results || data?.results || []
      log.push(`saavn.dev results array length: ${results.length}`)
      if (results.length > 0) {
        const songs = parseSaavnDev(results)
        log.push(`saavn.dev parsed ${songs.length} songs with URLs`)
        if (songs.length > 0) {
          console.log('[music-search] SUCCESS saavn.dev:', songs.length, 'songs in', Date.now()-ts, 'ms')
          return {
            statusCode:200, headers:CORS,
            body: JSON.stringify({success:true, source:'saavn.dev', data:{results:songs}, _log:log})
          }
        }
      }
    }
    log.push(`saavn.dev: no usable results (status ${status})`)
  } catch(e) {
    log.push(`saavn.dev ERROR: ${e.message}`)
    console.error('[music-search] saavn.dev failed:', e.message)
  }

  // ── 2. JioSaavn internal API ────────────────────────────────────────────────
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`Trying JioSaavn internal: ${url}`)
    const { status, raw } = await get(url)
    log.push(`JioSaavn status: ${status}, bytes: ${raw.length}`)
    if (status === 200) {
      const data = JSON.parse(raw)
      const results = data?.results || []
      log.push(`JioSaavn results array length: ${results.length}`)
      if (results.length > 0) {
        const songs = parseInternal(results)
        log.push(`JioSaavn parsed ${songs.length} songs with URLs`)
        if (songs.length > 0) {
          console.log('[music-search] SUCCESS JioSaavn internal:', songs.length, 'songs in', Date.now()-ts, 'ms')
          return {
            statusCode:200, headers:CORS,
            body: JSON.stringify({success:true, source:'jiosaavn-internal', data:{results:songs, total:parseInt(data.total)||songs.length}, _log:log})
          }
        }
      }
    }
    log.push(`JioSaavn internal: no usable results (status ${status})`)
  } catch(e) {
    log.push(`JioSaavn internal ERROR: ${e.message}`)
    console.error('[music-search] JioSaavn internal failed:', e.message)
  }

  // ── 3. saavn.me ─────────────────────────────────────────────────────────────
  try {
    const url = `https://saavn.me/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`Trying saavn.me: ${url}`)
    const { status, raw } = await get(url)
    log.push(`saavn.me status: ${status}, bytes: ${raw.length}`)
    if (status === 200) {
      const data = JSON.parse(raw)
      const results = data?.data?.results || data?.results || []
      log.push(`saavn.me results: ${results.length}`)
      if (results.length > 0) {
        const songs = parseSaavnDev(results)
        log.push(`saavn.me parsed ${songs.length} songs`)
        if (songs.length > 0) {
          console.log('[music-search] SUCCESS saavn.me:', songs.length, 'songs in', Date.now()-ts, 'ms')
          return {
            statusCode:200, headers:CORS,
            body: JSON.stringify({success:true, source:'saavn.me', data:{results:songs}, _log:log})
          }
        }
      }
    }
    log.push(`saavn.me: no usable results (status ${status})`)
  } catch(e) {
    log.push(`saavn.me ERROR: ${e.message}`)
    console.error('[music-search] saavn.me failed:', e.message)
  }

  // ── 4. jiosaavn-api on Vercel (community fork) ──────────────────────────────
  try {
    const url = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`Trying Vercel fork: ${url}`)
    const { status, raw } = await get(url)
    log.push(`Vercel fork status: ${status}, bytes: ${raw.length}`)
    if (status === 200) {
      const data = JSON.parse(raw)
      const results = data?.data?.results || data?.results || []
      if (results.length > 0) {
        const songs = parseSaavnDev(results)
        if (songs.length > 0) {
          console.log('[music-search] SUCCESS Vercel fork:', songs.length, 'songs in', Date.now()-ts, 'ms')
          return {
            statusCode:200, headers:CORS,
            body: JSON.stringify({success:true, source:'vercel-fork', data:{results:songs}, _log:log})
          }
        }
      }
    }
    log.push(`Vercel fork: no usable results (status ${status})`)
  } catch(e) {
    log.push(`Vercel fork ERROR: ${e.message}`)
  }

  // All failed — return detailed debug info
  console.error('[music-search] ALL FAILED in', Date.now()-ts, 'ms. Log:', log)
  return {
    statusCode:502, headers:CORS,
    body: JSON.stringify({
      success:false,
      error:'Music service temporarily unavailable. All APIs failed.',
      _log: log,
      _time: Date.now()-ts
    })
  }
}
