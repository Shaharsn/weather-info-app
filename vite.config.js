import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// aviationweather.gov (METAR) does not send CORS headers, so the browser cannot
// call it directly. Proxy it through the dev/preview server so the request is
// same-origin. Open-Meteo sends `access-control-allow-origin: *` and is called directly.
const metarProxy = {
  '/metar-api': {
    target: 'https://aviationweather.gov',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/metar-api/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: metarProxy },
  preview: { proxy: metarProxy },
})
