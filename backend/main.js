import { createApp } from './src/app.js'
import { env } from './src/config/env.js'
import { closePrisma } from './src/lib/prisma.js'

// Fail fast rather than serving an open admin API in production.
env.assertAdminConfigured()

const server = createApp().listen(env.port, () => {
  console.log(`TedorPath API listening on http://localhost:${env.port}`)
  if (!env.adminApiToken) {
    console.warn(
      '[warning] ADMIN_API_TOKEN is not set — /api/admin is open. Set it before exposing this server.',
    )
  }
})

// Close the database pool so the process can exit cleanly.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await closePrisma()
      process.exit(0)
    })
  })
}
