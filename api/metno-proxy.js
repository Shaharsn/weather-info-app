// Vercel serverless proxy → api.met.no (injects User-Agent, no CORS).
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace(/^\/metno-api/, '') + url.search
  const r = await fetch(`https://api.met.no${path}`, {
    headers: { 'User-Agent': 'weather-info-app/1.0 (personal, non-commercial)' },
  })
  const body = await r.text()
  res.setHeader('Content-Type', r.headers.get('Content-Type') || 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(r.status).send(body)
}
