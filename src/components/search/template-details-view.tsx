import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { AUDIENCE_BY_ID, COLOR_BY_ID, DOC_TYPE_BY_ID, FORMAT_BY_ID, GENDER_BY_ID, LANGUAGE_BY_ID, MOOD_BY_ID } from '@/lib/search/taxonomy'
import { getTemplateDetails } from '@/lib/search/template-details'
import { getVocabulary, labelFor, type Vocabulary } from '@/lib/search/vocabulary'

/**
 * Everything known about one template. Used by the full page (/templates/[id])
 * and by the modal that opens over search results.
 */
export async function TemplateDetailsView({ id }: { id: string }) {
  const templateId = Number(id)
  if (!Number.isInteger(templateId) || templateId <= 0) notFound()
  const [t, vocab] = await Promise.all([getTemplateDetails(templateId), getVocabulary()])
  if (!t) notFound()

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
      {/* Image with the template facts under it, so both columns fill evenly. */}
      <section aria-label="Pages" className="flex flex-col gap-4">
        {t.pages.map((page, i) => (
          <figure key={page.pageId} className="flex flex-col gap-1">
            <div
              className="bg-muted relative w-full overflow-hidden rounded-lg border"
              style={{ aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : t.isPortrait === false ? '4 / 3' : '5 / 7' }}
            >
              <Image src={page.imageUrl} alt={`${t.name}, page ${i + 1}`} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-contain" priority={i === 0} />
            </div>
            {t.pages.length > 1 && <figcaption className="text-muted-foreground text-xs">Page {i + 1}</figcaption>}
          </figure>
        ))}
        {t.pages.length === 0 && <p className="text-muted-foreground text-sm">No preview image.</p>}
        <Block title="Template">
          <Rows
            rows={[
              ['Template ID', String(t.id)],
              ['UUID', t.uuid ?? t.universalId ?? '—'],
              ['Catalog ID', t.catalogId ? String(t.catalogId) : '—'],
              ['Price', [t.isFreeWeb && 'Free on web', t.isFreeIos && 'Free on iOS'].filter(Boolean).join(', ') || 'PRO'],
              ['Orientation', t.isPortrait === false ? 'Landscape' : 'Portrait'],
              ['Size', t.width && t.height ? `${t.width} × ${t.height}` : '—'],
              ['Pages', String(t.pages.length || 1)],
              ['Created', t.createdAt.slice(0, 10)],
              ['Updated', t.updatedAt?.slice(0, 10) ?? '—'],
              ['Synced to search', t.syncedAt.slice(0, 10)],
            ]}
          />
        </Block>
      </section>

      <section aria-label="Details" className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t.name || 'Untitled template'}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={t.isFree ? 'secondary' : 'default'}>{t.isFree ? 'Free' : 'PRO'}</Badge>
            {t.isFeatured && <Badge variant="outline">Featured</Badge>}
            {t.occasion && <Badge variant="outline">{labelFor(vocab, 'occasion', t.occasion)}</Badge>}
          </div>
          {t.summary && <p className="text-muted-foreground text-sm">{t.summary}</p>}
        </header>

        {/* Sections flow into two columns on wide screens, so less scrolling is needed. */}
        <div className="gap-4 md:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">

        <Block title="Search tags" note={`Tagged by ${t.enrichSource === 'ai' ? 'AI' : t.enrichSource === 'rules' ? 'rules (no AI yet)' : 'nobody yet'}${t.enrichedAt ? ` on ${t.enrichedAt.slice(0, 10)}` : ''}`}>
          <Rows
            rows={[
              ['Occasion', t.occasion ? `${labelFor(vocab, 'occasion', t.occasion)} · ${Math.round(t.occasionConfidence * 100)}% confidence` : '—'],
              ['Occasion group', t.occasion ? vocab.byKind.occasion.get(t.occasion)?.occasionGroup ?? '—' : '—'],
              ['Also fits', t.extraOccasions.map((o) => labelFor(vocab, 'occasion', o)).join(', ') || '—'],
              ['Gender', t.gender ? GENDER_BY_ID.get(t.gender)?.label ?? t.gender : '—'],
              ['Milestone', t.milestone ? String(t.milestone) : '—'],
              ['Format', t.format ? FORMAT_BY_ID.get(t.format)?.label ?? t.format : '—'],
              ['Type', t.docType ? DOC_TYPE_BY_ID.get(t.docType)?.label ?? t.docType : '—'],
              ['Audience', t.audience ? AUDIENCE_BY_ID.get(t.audience)?.label ?? t.audience : '—'],
              ['Language', t.languages.map((l) => LANGUAGE_BY_ID.get(l)?.label ?? l).join(', ') || '—'],
              ['Photo', t.hasPhoto ? (t.photoSlot ? 'Yes, has a photo frame' : 'Yes') : 'No'],
              ['Quality score', t.qualityScore.toFixed(2)],
            ]}
          />
          <Chips label="Themes" kind="theme" ids={t.themes} vocab={vocab} />
          <Chips label="Elements" kind="asset" ids={t.assets} vocab={vocab} />
          <Chips label="Styles" kind="style" ids={t.styles} vocab={vocab} />
          <Chips label="Mood" ids={t.moods} toLabel={(m) => MOOD_BY_ID.get(m)?.label ?? m} />
          <Chips label="Colors" ids={t.colors} toLabel={(c) => COLOR_BY_ID.get(c)?.label ?? c} />
          <Chips label="Color shades" ids={t.colorShades} toLabel={(c) => c} />
        </Block>

        <Block title="Text on the card">
          <p className="text-sm whitespace-pre-line">{t.cardText ? t.cardText.split(' | ').join('\n') : '—'}</p>
        </Block>

        <Block title="Search activity">
          <Rows
            rows={[
              ['Previews', String(t.activity.clicks)],
              ['Used', String(t.activity.opens)],
              ['Quick bounces', String(t.activity.bounces)],
            ]}
          />
          {t.activity.searches.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Found through: {t.activity.searches.map((s) => `“${s.query}” (${s.count})`).join(', ')}
            </p>
          )}
        </Block>

        <Block title="Original tags">
          <TagList label="Tags" values={t.tags} />
          {t.oldTags && <TagList label="Older tags" values={t.oldTags.split(',').map((x) => x.trim()).filter(Boolean)} />}
        </Block>

        {t.rawTerms && (
          <Block title="Words returned by AI" note="Before mapping to the vocabulary">
            <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 text-xs">{JSON.stringify(t.rawTerms, null, 2)}</pre>
          </Block>
        )}
        </div>
      </section>
    </div>
  )
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Tag chips; each one runs a search for that term. */
function Chips({
  label,
  ids,
  kind,
  vocab,
  toLabel,
}: {
  label: string
  ids: string[]
  kind?: 'theme' | 'asset' | 'style'
  vocab?: Vocabulary
  toLabel?: (id: string) => string
}) {
  const name = (id: string) => (toLabel ? toLabel(id) : kind && vocab ? labelFor(vocab, kind, id) : id)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      {ids.length === 0 ? (
        <span className="text-sm">—</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <Link key={id} href={`/search?q=${encodeURIComponent(name(id))}`}>
              <Badge variant="secondary" className="hover:bg-secondary/70">
                {name(id)}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function TagList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.length === 0 ? (
          <span className="text-sm">—</span>
        ) : (
          values.map((v) => (
            <Badge key={v} variant="outline" className="font-normal">
              {v}
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
