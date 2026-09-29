import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

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
        // Forward the host and scheme the browser actually used, alongside the
        // rewritten one. The OAuth callback has to be served from the same
        // origin the app is served from — otherwise the session cookie is set
        // for localhost:4000 and the app on localhost:5173 never sends it back.
        xfwd: true,
      },
    },
    watch: {
      // Native file watching relies on the OS inotify limit, which is easily
      // exhausted on a machine running several editors — the watcher then dies
      // with `ENOSPC: System limit for number of file watchers reached`.
      // Polling avoids that entirely, so it is the default here. Raise the host
      // limit (see README) and start with VITE_USE_POLLING=false to go back to
      // native watching.
      usePolling: process.env.VITE_USE_POLLING !== 'false',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
