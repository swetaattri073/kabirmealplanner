import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward nutrition lookups to the local proxy server (see server/index.js)
    // so the app can just fetch('/api/nutrition/...') without worrying about
    // CORS or exposing the USDA API key in client code.
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
})
