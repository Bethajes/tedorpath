import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'

import { env } from '../config/env.js'

/**
 * Single shared Prisma client.
 *
 * Prisma 7 connects through a driver adapter rather than a bundled engine, so
 * the underlying `pg` pool is created here and must be closed on shutdown.
 */
const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
})

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: env.isProduction ? ['error'] : ['error', 'warn'],
})

/** Close the pool cleanly so the process can exit. */
export async function closePrisma() {
  await prisma.$disconnect()
  await pool.end()
}
