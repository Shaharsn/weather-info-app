// Vite plugin that adds a POST /api/accuracy-log endpoint so the browser can
// append rows to model-accuracy.jsonl (newline-delimited JSON — easy to query,
// append-safe, and can be converted to Markdown on demand).
import fs from 'node:fs'
import path from 'node:path'

const LOG_FILE = path.resolve('model-accuracy.jsonl')

export default function accuracyLogPlugin() {
  return {
    name: 'accuracy-log',
    configureServer(server) {
      server.middlewares.use('/api/accuracy-log', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405; res.end('Method Not Allowed'); return
        }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            JSON.parse(body) // validate before writing
            fs.appendFileSync(LOG_FILE, body.trim() + '\n', 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}
