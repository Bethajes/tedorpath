// Prisma 7 CLI configuration.
//
// The connection URL lives here rather than in schema.prisma: Prisma 7 reads it
// from this file for migrations, while the runtime client receives a driver
// adapter (see src/lib/prisma.js).
import 'dotenv/config'

import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
