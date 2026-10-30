import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { normalizeQuery } from '@/lib/search/parse-query'

const bodySchema = z.object({
  sessionId: z.string().min(1).max(100),
  query: z.string().max(200),
  filters: z.record(z.string(), z.unknown()).default({}),
  page: z.number().int().min(1).max(1000).default(1),
  intent: z.record(z.string(), z.unknown()),
  resultCount: z.number().int().min(0),
  exactCount: z.number().int().min(0).optional(),
  topScore: z.number().nullable(),
  ignored: z.array(z.string().max(100)).max(20).default([]),
})

/** Records one shown search. Called by the search page in the browser. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid search log' }, { status: 400 })

  const b = parsed.data
  const { rows } = await db.query<{ id: string }>(
    `insert into search_log (session_id, query, normalized_query, intent, filters, page, result_count, exact_count, top_score, ignored)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [
      b.sessionId, b.query, normalizeQuery(b.query), JSON.stringify(b.intent), JSON.stringify(b.filters), b.page,
      b.resultCount, b.exactCount ?? null, b.topScore, b.ignored,
    ],
  )
  return NextResponse.json({ id: Number(rows[0].id) })
}
