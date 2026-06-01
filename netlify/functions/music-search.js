// Netlify serverless function — proxies JioSaavn API, solves CORS
exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  const params = event.queryStringParameters || {}
  const query = params.query || ''
  const page = params.page || 1
  const limit = params.limit || 20
  const type = params.type || 'songs' // songs | albums | artists

  if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'query required' }) }

  // Try multiple JioSaavn API endpoints in order
  const APIS = [
    `https://saavn.dev/api/search/${type}?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    `https://jiosaavn-api-privatecvc2.vercel.app/search/${type}?query=${encodeURIComponent(query)}&n=${limit}&p=${page}`,
  ]

  for (const url of APIS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppiStream/3.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      // Normalise response shape
      const results = data?.data?.results || data?.data || data?.results || []
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: { results } }),
      }
    } catch(_) { continue }
  }

  return { statusCode: 502, headers, body: JSON.stringify({ error: 'All music APIs failed' }) }
}
