/**
 * Fills template_search.prints_rsvp from every text layer of the legacy templates, without touching any other
 * column (a full sync would also pick up other upstream changes). New syncs fill it themselves.
 * Usage: npm run search:fill-rsvp
 */
import { db } from '@/lib/db'
import { printsRsvp } from '@/lib/search/card-text'

const BATCH = 500

async function main() {
  const ids = (await db.query<{ template_id: number }>('select template_id from template_search order by template_id')).rows.map((r) => r.template_id)
  let printed = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const { rows } = await db.query<{ id: number; json_data: string | null }>(
      'select id, json_data from images where id = any($1)',
      [ids.slice(i, i + BATCH)],
    )
    const values = rows.map((r) => ({ id: r.id, rsvp: printsRsvp(r.json_data) }))
    printed += values.filter((v) => v.rsvp).length
    await db.query(
      `update template_search t set prints_rsvp = v.rsvp
         from jsonb_to_recordset($1::jsonb) as v(id int, rsvp boolean)
        where t.template_id = v.id and t.prints_rsvp is distinct from v.rsvp`,
      [JSON.stringify(values)],
    )
  }
  console.log(`checked ${ids.length} templates; ${printed} print an RSVP line`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
