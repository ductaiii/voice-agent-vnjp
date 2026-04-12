import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = fs.existsSync('/.dockerenv')
  ? 'http://backend:8081'
  : 'http://127.0.0.1:8081'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts: ['localhost', 'ngoalong.shop', 'app.ngoalong.shop'],
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  }
})
