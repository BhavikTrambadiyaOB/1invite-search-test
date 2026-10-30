/**
 * Loads the starting vocabulary (occasions, themes, assets, styles) from taxonomy.ts into
 * vocab_term and vocab_alias. Safe to rerun: seed terms are updated, AI-learned terms are kept.
 * Usage: npm run search:vocab-seed
 */
import { db } from '@/lib/db'
import { pluralPhrase, singularPhrase } from '@/lib/search/singular'
import { ASSETS, OCCASIONS, STYLES, THEMES } from '@/lib/search/taxonomy'
import { normalizeText } from '@/lib/search/text'
import { refreshTermCounts } from '@/lib/search/vocabulary'

type SeedTerm = {
  kind: 'occasion' | 'theme' | 'asset' | 'style'
  id: string
  label: string
  occasion_group?: string | null
  parent?: string | null
  themes?: string[]
  phrases: string[]
}

async function main() {
  const terms: SeedTerm[] = [
    ...OCCASIONS.map((o) => ({ kind: 'occasion' as const, id: o.id, label: o.label, occasion_group: o.group, parent: o.parent ?? null, phrases: o.phrases })),
    ...THEMES.map((t) => ({ kind: 'theme' as const, id: t.id, label: t.label, phrases: t.phrases })),
    ...ASSETS.map((a) => ({ kind: 'asset' as const, id: a.id, label: a.label, themes: a.themes, phrases: a.phrases })),
    ...STYLES.map((s) => ({ kind: 'style' as const, id: s.id, label: s.label, phrases: s.phrases })),
  ]

  await db.query(
    `insert into vocab_term (kind, id, label, occasion_group, parent, themes, source)
     select kind, id, label, occasion_group, parent, coalesce(themes, '{}'), 'seed'
       from jsonb_to_recordset($1::jsonb) as r(kind text, id text, label text, occasion_group text, parent text, themes text[])
     on conflict (kind, id) do update set
       label = excluded.label, occasion_group = excluded.occasion_group, parent = excluded.parent, themes = excluded.themes
     where vocab_term.source = 'seed'`,
    [JSON.stringify(terms)],
  )

  // Aliases: the id, the label and every phrase, each in singular and plural form.
  const aliases: { kind: string; alias: string; term_id: string }[] = []
  for (const t of terms) {
    for (const phrase of [t.id.replace(/_/g, ' '), t.label, ...t.phrases]) {
      for (const form of [normalizeText(phrase), singularPhrase(phrase), pluralPhrase(phrase)]) {
        if (form) aliases.push({ kind: t.kind, alias: form, term_id: t.id })
      }
    }
  }
  const result = await db.query(
    `insert into vocab_alias (kind, alias, term_id, method)
     select distinct on (kind, alias) kind, alias, term_id, 'seed'
       from jsonb_to_recordset($1::jsonb) as r(kind text, alias text, term_id text)
     -- Seed spellings follow taxonomy.ts when it changes; spellings learned from AI are kept.
     on conflict (kind, alias) do update set term_id = excluded.term_id
       where vocab_alias.method = 'seed' and vocab_alias.term_id <> excluded.term_id`,
    [JSON.stringify(aliases)],
  )
  // Seed spellings removed from taxonomy.ts (e.g. "fun" moved from a style to a mood) are dropped.
  const removed = await db.query(
    `delete from vocab_alias a
      where a.method = 'seed'
        and not exists (select 1 from jsonb_to_recordset($1::jsonb) as r(kind text, alias text) where r.kind = a.kind and r.alias = a.alias)`,
    [JSON.stringify(aliases.map(({ kind, alias }) => ({ kind, alias })))],
  )
  await refreshTermCounts()
  console.log(`seeded ${terms.length} terms, ${result.rowCount ?? 0} new or changed spellings, ${removed.rowCount ?? 0} old spellings removed`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
