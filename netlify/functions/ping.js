// Simple test endpoint - visit /.netlify/functions/ping to verify functions work
exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      ok: true,
      message: 'AppiStream functions are working!',
      timestamp: new Date().toISOString(),
      node: process.version,
    })
  }
}
