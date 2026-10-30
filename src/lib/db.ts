import { Pool } from 'pg'

const globalForDb = globalThis as unknown as {
  dbPool?: Pool
}

function createPool() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.',
    )
  }

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    ...(process.env.DATABASE_SSL === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  })
}

/**
 * Shared PostgreSQL pool for server-side code.
 *
 * The pool is cached on globalThis in development so hot reloads do not create
 * a new pool (and new connections) on every module evaluation.
 */
export const db = globalForDb.dbPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = db
}

export async function checkDatabaseConnection() {
  const result = await db.query<{ ok: number }>('select 1 as ok')
  return result.rows[0]?.ok === 1
}
