/**
 * Applies SQL files in db/migrations once each, in name order.
 * Usage: npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'

async function main() {
  const dir = path.join(process.cwd(), 'db', 'migrations')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

  await db.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  )
  const applied = new Set(
    (await db.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name),
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(path.join(dir, file), 'utf8')
    const client = await db.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log(`applied ${file}`)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
  console.log('migrations up to date')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
