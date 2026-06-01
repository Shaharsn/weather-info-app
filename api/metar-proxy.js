// Vercel serverless proxy → aviationweather.gov (no CORS headers).
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const upstream = `https://aviationweather.gov${url.pathname.replace(/^\/metar-api/, '')}${url.search}`
  const r = await fetch(upstream)
  const body = await r.text()
  res.setHeader('Content-Type', r.headers.get('Content-Type') || 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(r.status).send(body)
}
