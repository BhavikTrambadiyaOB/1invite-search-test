import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { Pagination } from '@/components/search/pagination'
import { SearchNav } from '@/components/search/search-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TemplateOccasionFilter } from '@/components/search/template-occasion-filter'
import { db } from '@/lib/db'

const PAGE_SIZE = 24
const ENRICHMENT_SOURCES = ['all', 'ai', 'rules', 'none'] as const
const PRICE_FILTERS = ['all', 'free', 'premium'] as const

type SearchParams = PageProps<'/templates'>['searchParams']
type OccasionOption = { id: string; label: string; count: number }
type SourceCount = { source: string; count: number }
type TemplateRow = {
  id: number
  name: string
  previewUrl: string
  isFree: boolean
  isPortrait: boolean | null
  createdAt: Date | string
  occasion: string | null
  occasionConfidence: number
  milestone: number | null
  gender: string | null
  themes: string[]
  assets: string[]
  styles: string[]
  colors: string[]
  moods: string[]
  languages: string[]
  hasPhoto: boolean
  docType: string | null
  format: string | null
  summary: string
  qualityScore: number
  enrichSource: string
  enrichedAt: Date | string | null
}

export const metadata = {
  title: 'Template Library',
  description: 'Browse templates and inspect their search metadata.',
}

export default function TemplatesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[70vh] w-full max-w-7xl" />}>
      <TemplateLibrary searchParams={searchParams} />
    </Suspense>
  )
}

async function TemplateLibrary({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = first(params.q).trim().slice(0, 200)
  const occasions = [
    ...new Set(
      (Array.isArray(params.occasion) ? params.occasion : [params.occasion ?? ''])
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20)
  const sourceValue = first(params.source)
  const source = ENRICHMENT_SOURCES.includes(sourceValue as (typeof ENRICHMENT_SOURCES)[number]) ? sourceValue : 'all'
  const priceValue = first(params.price)
  const price = PRICE_FILTERS.includes(priceValue as (typeof PRICE_FILTERS)[number]) ? priceValue : 'all'
  const requestedPage = Number.parseInt(first(params.page), 10)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const values: unknown[] = []
  const where: string[] = []
  const add = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }

  if (query) {
    const nameParam = add(`%${query}%`)
    const id = /^\d+$/.test(query) && Number.isSafeInteger(Number(query)) ? Number(query) : null
    where.push(id === null ? `t.name ilike ${nameParam}` : `(t.template_id = ${add(id)} or t.name ilike ${nameParam})`)
  }
  if (occasions.length) where.push(`t.occasion = any(${add(occasions)}::text[])`)
  if (source !== 'all') where.push(`t.enrich_source = ${add(source)}`)
  if (price !== 'all') where.push(`t.is_free = ${add(price === 'free')}`)
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  const [occasionResult, sourceResult, countResult] = await Promise.all([
    db.query<OccasionOption>(
      `select t.occasion as id,
              coalesce(v.label, initcap(replace(t.occasion, '_', ' '))) as label,
              count(*)::int as count
         from template_search t
         left join vocab_term v on v.kind = 'occasion' and v.id = t.occasion
        where t.occasion is not null
        group by t.occasion, v.label
        order by label`,
    ),
    db.query<SourceCount>(
      `select enrich_source as source, count(*)::int as count
         from template_search
        group by enrich_source`,
    ),
    db.query<{ count: number }>(`select count(*)::int as count from template_search t ${whereSql}`, values),
  ])
  const sourceCounts = new Map(sourceResult.rows.map(({ source: item, count }) => [item, count]))
  const total = countResult.rows[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE
  const templates =
    total > 0
      ? (
          await db.query<TemplateRow>(
            `select t.template_id as id, t.name, t.preview_url as "previewUrl", t.is_free as "isFree",
                    t.is_portrait as "isPortrait", t.created_at as "createdAt", t.occasion,
                    t.occasion_confidence as "occasionConfidence", t.milestone, t.gender, t.themes,
                    t.assets, t.styles, t.colors, t.moods, t.languages, t.has_photo as "hasPhoto",
                    t.doc_type as "docType", t.format, t.summary, t.quality_score as "qualityScore",
                    t.enrich_source as "enrichSource", t.enriched_at as "enrichedAt"
               from template_search t
               ${whereSql}
              order by t.template_id desc
              limit ${add(PAGE_SIZE)} offset ${add(offset)}`,
            values,
          )
        ).rows
      : []

  const hrefForPage = (nextPage: number) => {
    const search = new URLSearchParams()
    if (query) search.set('q', query)
    for (const id of occasions) search.append('occasion', id)
    if (source !== 'all') search.set('source', source)
    if (price !== 'all') search.set('price', price)
    search.set('page', String(nextPage))
    return `/templates?${search}`
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-4">
        <BackLink href="/">Home</BackLink>
        <SearchNav active="templates" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Browse the catalog and see the search metadata attached to each design. Open a template for its full details,
            including original tags and raw AI output.
          </p>
        </div>
      </header>

      <form id="template-library-filters" action="/templates" method="get" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Name or template ID
          <Input name="q" defaultValue={query} placeholder="e.g. cowgirl or 69107" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Occasion (select multiple)
          <TemplateOccasionFilter
            options={occasionResult.rows}
            selected={occasions}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Metadata source
          <Select name="source" defaultValue={source}>
            <SelectTrigger aria-label="Filter by metadata source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Any source</SelectItem>
                <SelectItem value="ai">AI tagged ({(sourceCounts.get('ai') ?? 0).toLocaleString()})</SelectItem>
                <SelectItem value="rules">Rules tagged ({(sourceCounts.get('rules') ?? 0).toLocaleString()})</SelectItem>
                <SelectItem value="none">Not enriched ({(sourceCounts.get('none') ?? 0).toLocaleString()})</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Price
          <Select name="price" defaultValue={price}>
            <SelectTrigger aria-label="Filter by price" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Any price</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">PRO</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="outline">
            <Link href="/templates">Clear</Link>
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-4" aria-labelledby="template-results">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="template-results" className="text-xl font-semibold tracking-tight">Templates</h2>
            <p className="text-muted-foreground text-sm">{total.toLocaleString()} matching templates</p>
          </div>
          <Pagination page={currentPage} totalPages={totalPages} label="Template pages" hrefForPage={hrefForPage} />
        </div>

        {templates.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
            No templates match these filters. Try a different name, ID, or filter.
          </p>
        )}

        {total > 0 && (
          <div className="flex justify-end">
            <Pagination page={currentPage} totalPages={totalPages} label="Template pages" hrefForPage={hrefForPage} />
          </div>
        )}
      </section>
    </main>
  )
}

function TemplateCard({ template }: { template: TemplateRow }) {
  const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  const sourceLabel =
    template.enrichSource === 'ai'
      ? 'AI tagged'
      : template.enrichSource === 'rules'
        ? 'Rules tagged'
        : template.enrichSource === 'none'
          ? 'Not enriched'
          : template.enrichSource
  const metadataGroups = [
    ['Themes', template.themes],
    ['Elements', template.assets],
    ['Styles', template.styles],
    ['Colors', template.colors],
    ['Moods', template.moods],
    ['Languages', template.languages],
  ] as const
  const tags = metadataGroups.flatMap(([group, values]) => values.map((value) => `${group}: ${label(value)}`))

  return (
    <Card className="overflow-hidden">
      <Link href={`/templates/${template.id}`} aria-label={`View metadata for ${template.name || `template ${template.id}`}`}>
        <div
          className="bg-muted relative"
          style={{ aspectRatio: template.isPortrait === false ? '4 / 3' : '5 / 7' }}
        >
          {template.previewUrl ? (
            <Image
              src={template.previewUrl}
              alt={template.name || `Template ${template.id}`}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-contain"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No preview available</div>
          )}
        </div>
      </Link>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 flex-1 text-base leading-snug">
            <Link href={`/templates/${template.id}`} className="hover:underline">
              {template.name || 'Untitled template'}
            </Link>
          </CardTitle>
          <Badge variant={template.enrichSource === 'ai' ? 'secondary' : 'outline'}>{sourceLabel}</Badge>
        </div>
        <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
          <span>ID {template.id}</span>
          <span>{template.isFree ? 'Free' : 'PRO'}</span>
          {template.enrichedAt && <span>Tagged {new Date(template.enrichedAt).toISOString().slice(0, 10)}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {template.occasion && (
            <Badge variant="secondary">
              {label(template.occasion)} · {Math.round(template.occasionConfidence * 100)}%
            </Badge>
          )}
          {template.milestone && <Badge variant="outline">Milestone {template.milestone}</Badge>}
          {template.gender && <Badge variant="outline">{label(template.gender)}</Badge>}
          {template.format && <Badge variant="outline">{label(template.format)}</Badge>}
          {template.docType && <Badge variant="outline">{label(template.docType)}</Badge>}
          {template.hasPhoto && <Badge variant="outline">Photo</Badge>}
        </div>
        {template.summary && <p className="text-muted-foreground line-clamp-3 text-sm">{template.summary}</p>}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>
            ))}
            {tags.length > 10 && <Badge variant="outline">+{tags.length - 10}</Badge>}
          </div>
        )}
        <CardDescription>Quality {template.qualityScore.toFixed(2)}</CardDescription>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/templates/${template.id}`}>View full metadata</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}
