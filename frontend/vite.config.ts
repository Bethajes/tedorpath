import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Forward same-origin /api calls to the backend during development, so the
    // browser never makes a cross-origin request and CORS stays out of the way.
    // Set VITE_API_URL to bypass this and call the API from another host.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    watch: {
      // Escape hatch for machines with a low inotify watcher limit, where the
      // dev server otherwise fails with ENOSPC. Enable with VITE_USE_POLLING=1.
      usePolling: process.env.VITE_USE_POLLING === '1',
    },
  },
})
