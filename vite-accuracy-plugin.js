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
        res.setHeader('Content-Type', 'application/json')

        // GET — return the full log so the browser can compute accuracy weights.
        if (req.method === 'GET') {
          try {
            const raw = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : ''
            const entries = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
            res.end(JSON.stringify({ ok: true, entries }))
          } catch (e) {
            res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
          return
        }

        // POST — append a new record.
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            try {
              JSON.parse(body)
              fs.appendFileSync(LOG_FILE, body.trim() + '\n', 'utf8')
              res.end(JSON.stringify({ ok: true }))
            } catch (e) {
              res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: String(e) }))
            }
          })
          return
        }

        res.statusCode = 405; res.end('Method Not Allowed')
      })
    },
  }
}
