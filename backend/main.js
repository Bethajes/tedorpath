import { createApp } from './src/app.js'
import { env } from './src/config/env.js'
import { closePrisma } from './src/lib/prisma.js'

const server = createApp().listen(env.port, () => {
  console.log(`TedorPath API listening on http://localhost:${env.port}`)
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
