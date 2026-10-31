import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const bodySchema = z.object({
  searchId: z.number().int().positive(),
  templateId: z.number().int().positive(),
  type: z.enum(['click', 'open', 'bounce']),
  position: z.number().int().min(1).optional(),
})

/** Records a result preview click, an app-side template-use action, or a quick bounce. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid search event' }, { status: 400 })

  const { searchId, templateId, type, position } = parsed.data
  const result = await db.query(
    `insert into search_event (search_id, template_id, type, position)
     select $1, $2, $3, $4 where exists (select 1 from search_log where id = $1)`,
    [searchId, templateId, type, position ?? null],
  )
  if (result.rowCount === 0) return NextResponse.json({ error: 'Unknown search' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
