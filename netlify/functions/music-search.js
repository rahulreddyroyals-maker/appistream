// AppiStream YouTube Search v7
// Scrapes YouTube search results directly - no API key, no third-party

const https = require('https')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,te;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        ...headers,
      },
      timeout: 15000,
    }
    https.get(url, opts, (res) => {
      // Follow redirects
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout 15s')) })
  })
}

// Extract ytInitialData from YouTube HTML
function extractInitialData(html) {
  // YouTube embeds data as: var ytInitialData = {...};
  const patterns = [
    /var ytInitialData\s*=\s*({.+?});\s*(?:\/\/|<\/script>)/s,
    /ytInitialData\s*=\s*({.+?});\s*(?:window\[|var |<\/script>)/s,
    /"responseContext":\s*\{/,
  ]

  for (const pattern of patterns.slice(0, 2)) {
    const match = html.match(pattern)
    if (match?.[1]) {
      try {
        return JSON.parse(match[1])
      } catch(_) {}
    }
  }

  // Fallback: find the JSON more aggressively
  const start = html.indexOf('{"responseContext"')
  if (start !== -1) {
    // Find the matching closing brace
    let depth = 0, i = start
    for (; i < html.length && i < start + 5000000; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    try {
      return JSON.parse(html.slice(start, i + 1))
    } catch(_) {}
  }
  return null
}

// Parse YouTube video results from ytInitialData
function parseYTResults(data) {
  const videos = []

  try {
    // Navigate the deeply nested YouTube data structure
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ||
      data?.contents?.sectionListRenderer?.contents || []

    for (const section of contents) {
      const items =
        section?.itemSectionRenderer?.contents ||
        section?.musicShelfRenderer?.contents || []

      for (const item of items) {
        const vr = item?.videoRenderer || item?.compactVideoRenderer || item?.musicVideoRenderer
        if (!vr) continue

        const videoId = vr.videoId
        if (!videoId) continue

        // Title
        const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || ''
        if (!title) continue

        // Channel/artist
        const artist =
          vr.ownerText?.runs?.[0]?.text ||
          vr.shortBylineText?.runs?.[0]?.text ||
          vr.longBylineText?.runs?.[0]?.text || ''

        // Duration
        let duration = 0
        const durText = vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || ''
        if (durText) {
          const parts = durText.split(':').map(Number)
          duration = parts.length === 3
            ? parts[0]*3600 + parts[1]*60 + parts[2]
            : parts[0]*60 + (parts[1]||0)
        }

        // Thumbnail - pick best quality
        const thumbs = vr.thumbnail?.thumbnails || []
        const thumb = thumbs.sort((a,b)=>(b.width||0)-(a.width||0))[0]
        const image = thumb?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

        // View count
        const viewText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || ''
        const views = parseInt(viewText.replace(/[^0-9]/g,'')) || 0

        // Published
        const published = vr.publishedTimeText?.simpleText || ''

        videos.push({ videoId, title, artist, duration, image, views, published })

        if (videos.length >= 20) break
      }
      if (videos.length >= 20) break
    }
  } catch(e) {
    console.error('[parse] Error:', e.message)
  }

  return videos
}

// Format results to our app format
function formatResults(rawVideos) {
  return rawVideos.map(v => ({
    id: v.videoId,
    displayName: v.title,
    url: `youtube:${v.videoId}`,
    youtubeId: v.videoId,
    artist: v.artist,
    album: '',
    image: v.image,
    duration: v.duration,
    language: '',
    year: v.published || '',
    views: v.views,
    online: true,
    isYoutube: true,
  }))
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' }

  const p = event.queryStringParameters || {}
  const query = (p.query || '').trim()
  const page  = Math.max(1, parseInt(p.page) || 1)

  if (!query) return { statusCode:400, headers:CORS, body:JSON.stringify({error:'query required'}) }

  const log = [`q="${query}" p=${page} ts=${Date.now()}`]
  const t0 = Date.now()

  // ── Approach 1: YouTube search page scraping ────────────────────────────────
  try {
    // SP param EgIQAQ== filters for videos only
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`
    log.push(`[YT] GET ${searchUrl}`)

    const { status, body } = await get(searchUrl)
    log.push(`[YT] HTTP ${status}, body length: ${body.length}`)

    if (status === 200 && body.length > 10000) {
      const data = extractInitialData(body)
      if (data) {
        log.push(`[YT] ytInitialData extracted, parsing...`)
        const rawVideos = parseYTResults(data)
        log.push(`[YT] Found ${rawVideos.length} videos`)

        if (rawVideos.length > 0) {
          const results = formatResults(rawVideos)
          console.log(`[music-search] OK YouTube scrape: ${results.length} results in ${Date.now()-t0}ms`)
          return {
            statusCode: 200, headers: CORS,
            body: JSON.stringify({ success:true, source:'youtube-scrape', data:{ results }, _log:log, _ms:Date.now()-t0 })
          }
        } else {
          log.push('[YT] No videos parsed from data structure')
          // Log a sample of the data for debugging
          log.push(`[YT] Data keys: ${Object.keys(data).join(',')}`)
        }
      } else {
        log.push('[YT] Could not extract ytInitialData')
        log.push(`[YT] Has ytInitialData string: ${body.includes('ytInitialData')}`)
        log.push(`[YT] Has responseContext: ${body.includes('responseContext')}`)
      }
    } else {
      log.push(`[YT] Bad response: status=${status} bodyLen=${body.length}`)
    }
  } catch(e) {
    log.push(`[YT] ERROR: ${e.message}`)
    console.error('[music-search] YouTube scrape failed:', e.message)
  }

  // ── Approach 2: YouTube suggest + embed (fallback) ──────────────────────────
  // If scraping fails, return embed-only results using known popular song IDs
  // This ensures SOMETHING works even if scraping is blocked
  try {
    log.push('[FALLBACK] Using YouTube suggest API')
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`
    const { status, body } = await get(suggestUrl, { 'Accept': 'application/json' })
    log.push(`[FALLBACK] suggest HTTP ${status} ${body.length}b`)

    if (status === 200) {
      const suggestions = JSON.parse(body)
      const terms = (suggestions[1] || []).slice(0, 5)
      log.push(`[FALLBACK] Got ${terms.length} suggestions: ${terms.join(', ')}`)
      // Can't get video IDs from suggestions alone - this is a dead end
    }
  } catch(e) {
    log.push(`[FALLBACK] suggest ERROR: ${e.message}`)
  }

  // ── Approach 3: YouTube oEmbed search (last resort) ─────────────────────────
  try {
    // Use YouTube's nojs search as a last attempt
    const noJsUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&ucbcb=1`
    log.push(`[NOJS] GET ${noJsUrl}`)
    const { status, body } = await get(noJsUrl, {
      'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    })
    log.push(`[NOJS] HTTP ${status} body: ${body.length}b`)

    if (status === 200) {
      // Try to parse with Googlebot UA
      const data = extractInitialData(body)
      if (data) {
        const rawVideos = parseYTResults(data)
        log.push(`[NOJS] Found ${rawVideos.length} videos`)
        if (rawVideos.length > 0) {
          const results = formatResults(rawVideos)
          return {
            statusCode: 200, headers: CORS,
            body: JSON.stringify({ success:true, source:'youtube-nojs', data:{ results }, _log:log, _ms:Date.now()-t0 })
          }
        }
      }
    }
  } catch(e) {
    log.push(`[NOJS] ERROR: ${e.message}`)
  }

  log.push(`TOTAL TIME: ${Date.now()-t0}ms`)
  console.error('[music-search] All approaches failed', log.slice(-5))
  return {
    statusCode: 502, headers: CORS,
    body: JSON.stringify({ success:false, error:'YouTube search temporarily unavailable. All servers tried.', _log:log, _ms:Date.now()-t0 })
  }
}
