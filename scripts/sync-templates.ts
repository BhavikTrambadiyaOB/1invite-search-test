/**
 * Copies active templates from the legacy `images` table into `template_search`.
 * Safe to rerun: rows are upserted and inactive templates are removed.
 * Usage: npm run search:sync
 */
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { extractCardText, hasPhotoSlot } from '@/lib/search/card-text'

const BATCH = 500

type SourceRow = {
  id: number
  template_name: string | null
  search_category: string | null
  json_data: string | null
  json_pages_sequence: string | null
  image: string | null
  is_free: number | null
  is_ios_free: number | null
  is_portrait: number | null
  is_featured: number | null
  created_at: Date
}

function splitTags(value: string | null) {
  const tags = (value ?? '')
    .split(',')
    .map((tag) => tag.replace(/[-_]+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(tags)]
}

async function main() {
  const cdn = (process.env.CDN_URL ?? '').replace(/\/+$/, '')
  if (!cdn) console.warn('CDN_URL is not set; preview_url will be empty.')

  const ids = (
    await db.query<{ id: number }>(
      'select id from images where content_type = 1 and is_active = 1 order by id',
    )
  ).rows.map((r) => r.id)
  console.log(`syncing ${ids.length} templates`)

  let changed = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH)
    const { rows } = await db.query<SourceRow>(
      `select id, template_name, search_category, json_data, json_pages_sequence, image,
              is_free, is_ios_free, is_portrait, is_featured, created_at
         from images where id = any($1)`,
      [batchIds],
    )

    const records = rows.map((row) => {
      const name = (row.template_name ?? '').trim()
      const tags = splitTags(row.search_category)
      const cardText = extractCardText(row.json_data, row.json_pages_sequence)
      const previewUrl = row.image && cdn ? `${cdn}/${row.image}` : ''
      const sourceHash = createHash('md5')
        .update([name, tags.join(','), cardText, row.image ?? ''].join('\u0001'))
        .digest('hex')
      return {
        template_id: row.id,
        name,
        tags,
        card_text: cardText,
        preview_url: previewUrl,
        is_free: row.is_free === 1 || row.is_ios_free === 1,
        is_portrait: row.is_portrait === null ? null : row.is_portrait !== 0,
        is_featured: row.is_featured === 1,
        photo_slot: hasPhotoSlot(row.json_data),
        created_at: row.created_at,
        source_hash: sourceHash,
      }
    })

    const result = await db.query(
      `insert into template_search
         (template_id, name, tags, card_text, preview_url, is_free, is_portrait, is_featured, photo_slot, created_at, source_hash, synced_at)
       select * , now() from jsonb_to_recordset($1::jsonb) as r(
         template_id int, name text, tags text[], card_text text, preview_url text,
         is_free boolean, is_portrait boolean, is_featured boolean, photo_slot boolean, created_at timestamptz, source_hash text)
       on conflict (template_id) do update set
         name = excluded.name, tags = excluded.tags, card_text = excluded.card_text,
         preview_url = excluded.preview_url, is_free = excluded.is_free, is_portrait = excluded.is_portrait,
         is_featured = excluded.is_featured, photo_slot = excluded.photo_slot,
         has_photo = template_search.has_photo or excluded.photo_slot, created_at = excluded.created_at,
         source_hash = excluded.source_hash, synced_at = now()
       where template_search.source_hash is distinct from excluded.source_hash
          or template_search.is_free is distinct from excluded.is_free
          or template_search.is_featured is distinct from excluded.is_featured
          or template_search.is_portrait is distinct from excluded.is_portrait
          or template_search.photo_slot is distinct from excluded.photo_slot`,
      [JSON.stringify(records)],
    )
    changed += result.rowCount ?? 0
    process.stdout.write(`\r${Math.min(i + BATCH, ids.length)}/${ids.length}`)
  }

  const removed = await db.query(
    `delete from template_search t
      where not exists (select 1 from images i where i.id = t.template_id and i.content_type = 1 and i.is_active = 1)`,
  )
  console.log(`\nnew or changed: ${changed}, removed: ${removed.rowCount ?? 0}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
