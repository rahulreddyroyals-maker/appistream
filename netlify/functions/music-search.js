// AppiStream Music Search v6
// Uses Invidious API (open YouTube frontend) - no API key needed
// Falls back to multiple Invidious instances

const https = require('https')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

// Known public Invidious instances (open source YouTube frontends)
// These expose the same API as YouTube Data API but require no key
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacydev.net',
  'https://inv.nadeko.net',
  'https://invidious.lunar.icu',
  'https://invidious.fdn.fr',
  'https://iv.melmac.space',
  'https://invidious.perennialte.ch',
]

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AppiStream/3.6)',
        'Accept': 'application/json',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')) })
  })
}

// Parse Invidious search results into our track format
function parseInvidiousResults(results, instance) {
  return results
    .filter(v => v.type === 'video' || v.videoId)
    .map(v => {
      const thumb = (v.videoThumbnails || [])
        .sort((a,b) => (b.width||0)-(a.width||0))[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
      return {
        id: v.videoId,
        displayName: v.title || '',
        url: `youtube:${v.videoId}`,   // special prefix for YouTube tracks
        youtubeId: v.videoId,
        artist: v.author || v.channelHandle || '',
        album: '',
        image: thumb.startsWith('/') ? `${instance}${thumb}` : thumb,
        duration: parseInt(v.lengthSeconds || 0),
        language: '',
        year: v.published ? new Date(v.published*1000).getFullYear().toString() : '',
        views: v.viewCount || 0,
        online: true,
        isYoutube: true,
      }
    })
    .filter(v => v.displayName && v.youtubeId)
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' }

  const p = event.queryStringParameters || {}
  const query = (p.query || '').trim()
  const page  = Math.max(1, parseInt(p.page) || 1)

  if (!query) return { statusCode:400, headers:CORS, body:JSON.stringify({error:'query required'}) }

  const log = [`q="${query}" p=${page}`]
  const t0 = Date.now()

  // Try each Invidious instance until one works
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}&fields=videoId,title,author,lengthSeconds,videoThumbnails,published,viewCount`
      log.push(`Trying ${instance}`)
      const { status, body } = await get(url)
      log.push(`  HTTP ${status} ${body.length}b`)

      if (status === 200) {
        const results = JSON.parse(body)
        if (Array.isArray(results) && results.length > 0) {
          const songs = parseInvidiousResults(results, instance)
          log.push(`  parsed ${songs.length} videos`)
          if (songs.length > 0) {
            console.log(`[music-search] OK via ${instance}: ${songs.length} results in ${Date.now()-t0}ms`)
            return {
              statusCode: 200, headers: CORS,
              body: JSON.stringify({
                success: true,
                source: 'youtube-invidious',
                instance,
                data: { results: songs },
                _log: log,
                _ms: Date.now()-t0
              })
            }
          }
        }
        log.push(`  empty results`)
      }
    } catch(e) {
      log.push(`  ERR: ${e.message}`)
      console.warn(`[music-search] ${instance} failed:`, e.message)
    }
  }

  // All Invidious failed - return error with log
  console.error('[music-search] all instances failed in', Date.now()-t0, 'ms')
  return {
    statusCode: 502, headers: CORS,
    body: JSON.stringify({
      success: false,
      error: 'YouTube search temporarily unavailable. All servers tried.',
      _log: log,
      _ms: Date.now()-t0
    })
  }
}
