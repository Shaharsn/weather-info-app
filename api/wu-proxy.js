// Vercel serverless proxy → api.weather.com (rejects cross-origin).
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace(/^\/wu-api/, '') + url.search
  const r = await fetch(`https://api.weather.com${path}`)
  const body = await r.text()
  res.setHeader('Content-Type', r.headers.get('Content-Type') || 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(r.status).send(body)
}
