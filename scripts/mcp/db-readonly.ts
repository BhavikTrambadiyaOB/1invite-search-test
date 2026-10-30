/**
 * Read-only PostgreSQL MCP server for this project (stdio).
 * Registered in .mcp.json as "project-db". Reads DATABASE_URL from .env,
 * or MCP_DATABASE_URL when set (recommended: a database role with SELECT rights only).
 *
 * Safety layers:
 * - only SELECT / WITH / EXPLAIN / SHOW / VALUES / TABLE are accepted
 * - one statement per request (sent as a prepared statement, which Postgres limits to one command)
 * - runs inside BEGIN READ ONLY and is always rolled back
 * - statement timeout, row cap and long-value truncation
 * - server-admin and file-access functions are refused
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { z } from 'zod'

const MAX_ROWS = 200
const MAX_VALUE_CHARS = 500
const STATEMENT_TIMEOUT_MS = 15_000

const connectionString = process.env.MCP_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL (or MCP_DATABASE_URL) is not set')
  process.exit(1)
}

// Its own small pool: this process is separate from the Next.js app.
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 30_000,
  application_name: 'project-db-mcp-readonly',
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
})

const ALLOWED_START = /^\s*(select|with|explain|show|values|table)\b/i
const BLOCKED = new RegExp(
  '\\b(' +
    [
      'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf', 'pg_rotate_logfile', 'pg_promote',
      'pg_read_file', 'pg_read_binary_file', 'pg_ls_\\w+', 'pg_stat_file', 'lo_import', 'lo_export',
      'lo_\\w+', 'dblink\\w*', 'set_config', 'pg_advisory_\\w+', 'pg_sleep\\w*', 'nextval', 'setval',
      'copy', 'into',
    ].join('|') +
    ')\\b',
  'i',
)

/** Removes comments and string literals so keyword checks only see SQL structure. */
function stripLiterals(sql: string) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''")
}

function checkSql(sql: string): string | null {
  const bare = stripLiterals(sql).trim().replace(/;\s*$/, '')
  if (!bare) return 'Empty query.'
  if (!ALLOWED_START.test(bare)) return 'Only SELECT, WITH, EXPLAIN, SHOW, VALUES and TABLE queries are allowed.'
  if (bare.includes(';')) return 'Send one statement at a time.'
  const blocked = bare.match(BLOCKED)
  if (blocked) return `"${blocked[1]}" is not allowed in this read-only tool.`
  return null
}

function shorten(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_VALUE_CHARS) {
    return `${value.slice(0, MAX_VALUE_CHARS)}… [${value.length} chars]`
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (value && typeof value === 'object') {
    const text = JSON.stringify(value)
    return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}… [${text.length} chars]` : value
  }
  return value
}

async function runReadOnly(sql: string, params: unknown[] = []) {
  const client = await pool.connect()
  try {
    await client.query('begin transaction read only')
    await client.query(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    // A uniquely named statement uses the extended protocol, where Postgres rejects multiple commands.
    const result = await client.query({ name: `ro_${randomUUID()}`, text: sql.trim().replace(/;\s*$/, ''), values: params })
    return result
  } finally {
    await client.query('rollback').catch(() => {})
    client.release()
  }
}

function asText(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function asError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

const server = new McpServer({ name: 'project-db', version: '1.0.0' })

server.registerTool(
  'query',
  {
    title: 'Read-only SQL query',
    description:
      `Run one read-only SQL query against this project's PostgreSQL database. ` +
      `Only SELECT/WITH/EXPLAIN/SHOW/VALUES/TABLE. Returns at most ${MAX_ROWS} rows; long values are shortened. ` +
      'Use $1, $2… with params for values.',
    inputSchema: {
      sql: z.string().min(1).max(20_000).describe('One SQL statement'),
      params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(50).optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ sql, params }) => {
    const problem = checkSql(sql)
    if (problem) return asError(problem)
    try {
      const result = await runReadOnly(sql, params ?? [])
      const rows = result.rows.slice(0, MAX_ROWS).map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, shorten(v)])),
      )
      return asText({
        rowCount: result.rowCount ?? result.rows.length,
        returned: rows.length,
        truncated: result.rows.length > MAX_ROWS,
        rows,
      })
    } catch (error) {
      return asError(`Query failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
)

server.registerTool(
  'list_tables',
  {
    title: 'List tables',
    description: 'List tables in the public schema with estimated row counts.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const result = await runReadOnly(
        `select c.relname as table, greatest(c.reltuples, 0)::bigint as estimated_rows,
                pg_size_pretty(pg_total_relation_size(c.oid)) as size
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
          order by c.relname`,
      )
      return asText(result.rows.map((r) => ({ ...r, estimated_rows: Number(r.estimated_rows) })))
    } catch (error) {
      return asError(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
)

server.registerTool(
  'describe_table',
  {
    title: 'Describe table',
    description: 'Show the columns and indexes of a table in the public schema.',
    inputSchema: { table: z.string().min(1).max(128) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ table }) => {
    try {
      const columns = await runReadOnly(
        `select column_name, data_type, is_nullable, column_default
           from information_schema.columns
          where table_schema = 'public' and table_name = $1 order by ordinal_position`,
        [table],
      )
      if (columns.rows.length === 0) return asError(`Table "${table}" not found in the public schema.`)
      const indexes = await runReadOnly(
        `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = $1`,
        [table],
      )
      return asText({ table, columns: columns.rows, indexes: indexes.rows })
    } catch (error) {
      return asError(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
)

async function main() {
  await server.connect(new StdioServerTransport())
  const shutdown = () => {
    void pool.end().finally(() => process.exit(0))
  }
  process.stdin.on('close', shutdown)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
