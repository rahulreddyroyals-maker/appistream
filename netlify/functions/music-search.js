// AppiStream Music Search v4 — multiple API fallbacks with detailed logging
const https = require('https')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com',
      },
      timeout: 12000,
    }
    https.get(url, options, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout 12s')) })
  })
}

function decode(s) {
  return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
}

function parseNew(arr) {
  // saavn.dev / saavn.me format
  return arr.map(s => {
    const dlUrls = s.downloadUrl || []
    const best = dlUrls.find(u=>u.quality==='320kbps') || dlUrls.find(u=>u.quality==='160kbps') || dlUrls.find(u=>u.quality==='96kbps') || dlUrls[0]
    const imgs = Array.isArray(s.image) ? s.image : []
    const img = (imgs.find(i=>i.quality==='500x500') || imgs.find(i=>i.quality==='150x150') || imgs[0])?.url || ''
    const primaryArtists = Array.isArray(s.artists?.primary) ? s.artists.primary.map(a=>a.name).join(', ') : (s.primaryArtists || '')
    return {
      id: s.id, displayName: decode(s.name||s.title||''), url: best?.url || '',
      artist: decode(primaryArtists), album: s.album?.name||s.album||'', image: img,
      duration: parseInt(s.duration||0), language: s.language||'', year: s.year||''
    }
  }).filter(s => s.url && s.displayName)
}

function parseOld(arr) {
  // JioSaavn internal API format
  return arr.map(s => {
    const mi = s.more_info || {}
    const url = s.media_preview_url || mi.encrypted_media_url || ''
    return {
      id: s.id, displayName: decode(s.title||s.song||''), url,
      artist: decode(mi.singers||s.primary_artists||''), album: decode(mi.album||''),
      image: (s.image||'').replace('150x150','500x500').replace(/^http:/,'https:'),
      duration: parseInt(mi.duration||0), language: s.language||'', year: s.year||''
    }
  }).filter(s => s.url && s.displayName)
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' }

  const p = event.queryStringParameters || {}
  const query = (p.query||'').trim()
  const page  = Math.max(1, parseInt(p.page)||1)
  const limit = Math.min(30, parseInt(p.limit)||20)

  if (!query) return { statusCode:400, headers:CORS, body:JSON.stringify({error:'query required'}) }

  const log = [`query="${query}" page=${page}`]
  const t0 = Date.now()

  // ── API 1: saavn.dev ────────────────────────────────────────────────────────
  try {
    const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`API1 saavn.dev: GET ${url}`)
    const { status, body } = await httpsGet(url)
    log.push(`API1 status:${status} bytes:${body.length}`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      log.push(`API1 raw results: ${raw.length}`)
      const songs = parseNew(raw)
      log.push(`API1 with URLs: ${songs.length}`)
      if (songs.length > 0) {
        return { statusCode:200, headers:CORS, body:JSON.stringify({success:true,source:'saavn.dev',data:{results:songs},_log:log,_ms:Date.now()-t0}) }
      }
    }
  } catch(e) { log.push(`API1 ERROR: ${e.message}`) }

  // ── API 2: jiosaavn.com internal ────────────────────────────────────────────
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`API2 jiosaavn.com: GET`)
    const { status, body } = await httpsGet(url)
    log.push(`API2 status:${status} bytes:${body.length}`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.results || []
      log.push(`API2 raw results: ${raw.length}`)
      const songs = parseOld(raw)
      log.push(`API2 with URLs: ${songs.length}`)
      if (songs.length > 0) {
        return { statusCode:200, headers:CORS, body:JSON.stringify({success:true,source:'jiosaavn-internal',data:{results:songs,total:parseInt(j.total)||songs.length},_log:log,_ms:Date.now()-t0}) }
      }
    }
  } catch(e) { log.push(`API2 ERROR: ${e.message}`) }

  // ── API 3: saavn.me ─────────────────────────────────────────────────────────
  try {
    const url = `https://saavn.me/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    log.push(`API3 saavn.me: GET`)
    const { status, body } = await httpsGet(url)
    log.push(`API3 status:${status} bytes:${body.length}`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      log.push(`API3 raw results: ${raw.length}`)
      const songs = parseNew(raw)
      log.push(`API3 with URLs: ${songs.length}`)
      if (songs.length > 0) {
        return { statusCode:200, headers:CORS, body:JSON.stringify({success:true,source:'saavn.me',data:{results:songs},_log:log,_ms:Date.now()-t0}) }
      }
    }
  } catch(e) { log.push(`API3 ERROR: ${e.message}`) }

  // ── API 4: jiosaavn-api-privatecvc2.vercel.app ──────────────────────────────
  try {
    const url = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}&n=${limit}&p=${page}`
    log.push(`API4 vercel: GET`)
    const { status, body } = await httpsGet(url)
    log.push(`API4 status:${status} bytes:${body.length}`)
    if (status === 200) {
      const j = JSON.parse(body)
      const raw = j?.data?.results || j?.results || []
      log.push(`API4 raw results: ${raw.length}`)
      const songs = parseNew(raw)
      log.push(`API4 with URLs: ${songs.length}`)
      if (songs.length > 0) {
        return { statusCode:200, headers:CORS, body:JSON.stringify({success:true,source:'vercel-fork',data:{results:songs},_log:log,_ms:Date.now()-t0}) }
      }
    }
  } catch(e) { log.push(`API4 ERROR: ${e.message}`) }

  log.push(`ALL FAILED in ${Date.now()-t0}ms`)
  console.error('[music-search] All APIs failed:', log.join(' | '))
  return {
    statusCode:502, headers:CORS,
    body:JSON.stringify({ success:false, error:'All music APIs failed. See _log for details.', _log:log, _ms:Date.now()-t0 })
  }
}
