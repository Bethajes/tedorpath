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
    // The property tests render a component 100 times inside a single test, and
    // jsdom rendering is not fast. Test files run in parallel, so these tests
    // pass in seconds on an idle machine and then fail purely because the suite
    // was busy: the 5s default is far too small, and so was the 30s this used
    // to allow once the suite grew past a dozen files.
    //
    // They must be allowed to finish rather than time out. A timed-out property
    // test is worse than a slow one: its async loop keeps rendering into fresh
    // containers after Testing Library's `cleanup` has run, so its abandoned
    // DOM leaks into the next test and that one fails for an unrelated reason.
    testTimeout: 180_000,
    // Reported next to a timeout so a slow test is obvious in the output.
    slowTestThreshold: 20_000,
  },
})
