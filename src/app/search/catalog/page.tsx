import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { BackLink } from '@/components/search/back-link'
import { Pagination } from '@/components/search/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'

const PAGE_SIZE = 24

type CatalogOption = { catalogId: number; count: number }
type CatalogTemplate = {
  id: number
  name: string
  previewUrl: string
  occasion: string | null
  styles: string[]
  width: number | null
  height: number | null
  isPortrait: boolean | null
}
type CatalogSearchParams = PageProps<'/search/catalog'>['searchParams']

export const metadata = {
  title: 'Catalog inspector',
  description: 'Browse templates and metadata by catalog ID.',
}

export default function CatalogPage({ searchParams }: PageProps<'/search/catalog'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/search">Back to search</BackLink>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog inspector</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Inspect templates by catalog ID. Suggested IDs below contain Typography-style templates sized 320 × 160;
          enter any catalog ID to browse its full collection.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CatalogBrowser searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function CatalogBrowser({ searchParams }: { searchParams: CatalogSearchParams }) {
  const params = await searchParams
  const catalogParam = Array.isArray(params.catalogId) ? params.catalogId[0] : params.catalogId
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedCatalogId = Number(catalogParam)
  const catalogId =
    catalogParam && /^\d+$/.test(catalogParam) && Number.isSafeInteger(parsedCatalogId) && parsedCatalogId > 0
      ? parsedCatalogId
      : null
  const parsedPage = Number(pageParam)
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  await connection()
  const { rows: catalogOptions } = await db.query<CatalogOption>(
    `select i.catalog_id as "catalogId", count(*)::int as count
       from template_search t
       join images i on i.id = t.template_id
      where i.catalog_id is not null
        and i.width = 320 and i.height = 160
        and t.styles @> array['typography']::text[]
      group by i.catalog_id
      order by i.catalog_id`,
  )

  let total = 0
  let totalPages = 1
  let currentPage = page
  let templates: CatalogTemplate[] = []
  if (catalogId) {
    const { rows: countRows } = await db.query<{ count: number }>(
      `select count(*)::int as count
         from template_search t
         join images i on i.id = t.template_id
        where i.catalog_id = $1`,
      [catalogId],
    )
    total = countRows[0]?.count ?? 0
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    currentPage = Math.min(page, totalPages)

    if (total > 0) {
      const { rows } = await db.query<CatalogTemplate>(
        `select t.template_id as id, t.name, t.preview_url as "previewUrl", t.occasion,
                t.styles, i.width, i.height, i.is_portrait as "isPortrait"
           from template_search t
           join images i on i.id = t.template_id
          where i.catalog_id = $1
          order by t.template_id
          limit $2 offset $3`,
        [catalogId, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE],
      )
      templates = rows
    }
  }

  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams({ catalogId: String(catalogId), page: String(nextPage) })
    return `/search/catalog?${query}`
  }

  return (
    <>
      <form action="/search/catalog" method="get" className="flex max-w-xl items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
          Catalog ID
          <Input
            type="number"
            name="catalogId"
            min="1"
            step="1"
            required
            defaultValue={catalogId ?? ''}
            placeholder="For example, 1058"
          />
        </label>
        <Button type="submit">View catalog</Button>
      </form>

      <section aria-labelledby="candidate-catalogs">
        <Card>
          <CardHeader>
            <CardTitle id="candidate-catalogs">Typography · 320 × 160 candidates</CardTitle>
            <CardDescription>
              Select an ID to inspect all templates in that catalog, not just the matching-size templates.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {catalogOptions.map(({ catalogId: optionId, count }) => (
              <Button key={optionId} asChild variant={optionId === catalogId ? 'default' : 'outline'}>
                <Link href={`/search/catalog?catalogId=${optionId}`}>
                  {optionId} <span className="text-xs opacity-80">({count})</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      {catalogId && (
        <section className="flex flex-col gap-4" aria-labelledby="catalog-results">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="catalog-results" className="text-xl font-semibold tracking-tight">
                Catalog {catalogId}
              </h2>
              <p className="text-muted-foreground text-sm">
                {total.toLocaleString()} {total === 1 ? 'template' : 'templates'}
              </p>
            </div>
            {total > 0 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                label="Catalog pages"
                hrefForPage={pageHref}
              />
            )}
          </div>

          {templates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <Card key={template.id} className="overflow-hidden">
                  <Link href={`/templates/${template.id}`} className="block">
                    <div className="bg-muted relative aspect-[2/1]">
                      {template.previewUrl ? (
                        <Image
                          src={template.previewUrl}
                          alt={template.name || `Template ${template.id}`}
                          fill
                          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-contain"
                        />
                      ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                          No preview available
                        </div>
                      )}
                    </div>
                  </Link>
                  <CardHeader className="gap-1">
                    <CardTitle className="line-clamp-2 text-sm">
                      <Link href={`/templates/${template.id}`} className="hover:underline">
                        {template.name || 'Untitled template'}
                      </Link>
                    </CardTitle>
                    <CardDescription>Template ID {template.id}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">
                      {template.width ?? '?'} × {template.height ?? '?'}
                    </Badge>
                    <Badge variant="outline">
                      {template.isPortrait === false ? 'Landscape' : template.isPortrait === true ? 'Portrait' : 'Unknown orientation'}
                    </Badge>
                    {template.occasion && <Badge variant="secondary">{template.occasion.replace(/_/g, ' ')}</Badge>}
                    {template.styles.map((style) => (
                      <Badge key={style} variant="outline">
                        {style.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
              No templates found for catalog ID {catalogId}.
            </p>
          )}

          {total > 0 && (
            <div className="flex justify-end">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                label="Catalog pages"
                hrefForPage={pageHref}
              />
            </div>
          )}
        </section>
      )}
    </>
  )
}
