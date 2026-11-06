import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { InfoIcon } from 'lucide-react'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { Pagination } from '@/components/search/pagination'
import { SearchNav } from '@/components/search/search-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FAILURE_RULES, getFailedQueries, type FailedQuery } from '@/lib/search/failed-queries'

export const metadata: Metadata = {
  title: 'Failed Queries',
  description: 'Searches where users did not find a template.',
}

const RANGES = [1, 7, 30, 90] as const
const PAGE_SIZE = 10
const MIN_VISIT_OPTIONS = [1, 2, 5, 10] as const
const SORT_OPTIONS = ['priority', 'visits', 'recent'] as const

const REASON_LABELS: Record<string, string> = {
  zero_results: 'No results',
  no_exact_match: 'No exact match',
  few_exact_matches: 'Few exact matches',
  low_relevance: 'Weak matches',
  reading_removed: 'Reading removed',
  reformulated: 'Searched again',
  bounce: 'Quick bounce',
  no_click: 'No click',
}

function formatAverage(value: number | null) {
  if (value === null) return '–'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function collectionDirection(query: FailedQuery) {
  if (query.gapType === 'search_gap') {
    const terms = query.unknownWords.length > 0 ? query.unknownWords.join(', ') : 'the query wording'
    return `Teach search to recognize ${terms}.`
  }

  const intent = query.exampleIntent
  const focus: string[] = []
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) focus.push(value.replace(/_/g, ' '))
  }
  const addMany = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(add)
  }

  add(intent?.occasion)
  addMany(intent?.alsoOccasions)
  add(intent?.milestone ? `${intent.milestone} milestone` : null)
  addMany(intent?.themes)
  addMany(intent?.assets)
  addMany(intent?.styles)
  addMany(intent?.colors)
  addMany(intent?.moods)
  add(intent?.format)
  add(intent?.docType)
  add(intent?.gender)
  add(intent?.language)
  addMany(intent?.keywords)
  if (intent?.hasPhoto === true) add('photo')
  if (intent?.hasPhoto === false) add('without photo')

  const collectionFocus = [...new Set(focus)].slice(0, 5).join(', ') || query.exampleQuery
  const directMatches = query.avgDirect
  const coverageCount = directMatches ?? query.avgExact
  if (coverageCount === null) {
    return `Check coverage for ${collectionFocus}; exact-match data is unavailable for this period.`
  }
  const coverageLabel = directMatches === null
    ? `${formatAverage(coverageCount)} legacy exact-match ${coverageCount === 1 ? 'result' : 'results'}`
    : `${formatAverage(coverageCount)} direct ${coverageCount === 1 ? 'template' : 'templates'}`
  if (coverageCount >= FAILURE_RULES.fewExactMatches) {
    if (query.avgRelevance !== null && query.avgRelevance < FAILURE_RULES.lowRelevance) {
      return `Improve search relevance for ${collectionFocus}; there are ${coverageLabel} per visit on average, but the best matches score weakly.`
    }
    if (query.avgRelevance === null) {
      return `Review match quality for ${collectionFocus}; there are ${coverageLabel} per visit on average, but relevance data is unavailable.`
    }
    return `Coverage looks strong for ${collectionFocus} (${coverageLabel} per visit); review why users did not choose a result before expanding the collection.`
  }

  return `Add or enrich templates for ${collectionFocus}; average coverage is ${coverageLabel} per visit.`
}

export default function InsightsPage({ searchParams }: PageProps<'/search/insights'>) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchNav active="failed" />
          <BackLink href="/search">Back to search</BackLink>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Failed queries</h1>
          <Badge variant="secondary">Phase 2</Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="About failed queries">
                <InfoIcon />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] sm:max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>How to read failed queries</DialogTitle>
                <DialogDescription>
                  A quick guide to interpreting these searches and their match counts.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5">
                <Card className="gap-0 py-0">
                  <CardHeader className="gap-1 px-4 py-4">
                    <CardTitle>Match counts</CardTitle>
                    <CardDescription>
                      These are averages per visit, calculated from the first typed search before tag taps or filters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <Badge>Direct</Badge>
                      <p className="text-muted-foreground mt-2 text-sm">
                        Matches the occasion, when recognized, and every recognized detail in the query.
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <Badge variant="secondary">Partial</Badge>
                      <p className="text-muted-foreground mt-2 text-sm">
                        The remaining results after Direct and Occasion only are counted.
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <Badge variant="outline">Occasion only</Badge>
                      <p className="text-muted-foreground mt-2 text-sm">
                        Matches the occasion, but none of the query’s other requested details.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="text-muted-foreground border-t px-4 pt-3 pb-4 text-xs">
                    Partial = Templates − Direct − Occasion only
                  </CardFooter>
                </Card>

                <section className="flex flex-col gap-3" aria-labelledby="other-columns-heading">
                  <h3 id="other-columns-heading" className="text-sm font-semibold">Other columns</h3>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium">Templates</dt>
                      <dd className="text-muted-foreground text-sm">Average number of results returned per visit.</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium">Top relevance</dt>
                      <dd className="text-muted-foreground text-sm">
                        Average relevance score of the best result per visit. Higher means a stronger match.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium">Content gap</dt>
                      <dd className="text-muted-foreground text-sm">
                        Search was understood, but suitable designs may be missing or need improvement.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium">Search gap</dt>
                      <dd className="text-muted-foreground text-sm">
                        Search was not understood; a synonym or search rule may be needed.
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium">Collection direction</dt>
                      <dd className="text-muted-foreground text-sm">
                        A suggestion for what to add or improve. A query like “dinosaur wedding” may return many
                        wedding templates but still have no exact match.
                      </dd>
                    </div>
                  </dl>
                </section>

                <p className="text-muted-foreground border-t pt-3 text-xs">
                  Match counts are unavailable for older searches logged before this breakdown was added.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Report({ searchParams }: { searchParams: PageProps<'/search/insights'>['searchParams'] }) {
  const sp = await searchParams
  const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  // The report covers the time up to now, so it is rendered per request, never prerendered.
  await connection()
  const requested = Number(param(sp.days))
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 7
  const query = param(sp.q)?.trim().slice(0, 200) ?? ''
  const gap = param(sp.gap)
  const gapFilter = gap === 'content_gap' || gap === 'search_gap' ? gap : ''
  const rawMinVisits = Number(param(sp.minVisits))
  const minVisits = (MIN_VISIT_OPTIONS as readonly number[]).includes(rawMinVisits) ? rawMinVisits : 1
  const rawSort = param(sp.sort)
  const sort = (SORT_OPTIONS as readonly string[]).includes(rawSort ?? '') ? rawSort! : 'priority'
  const rawPage = Number(param(sp.page))
  const requestedPage = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)

  const rows = await getFailedQueries({ from, to, limit: null })
  const filteredRows = rows
    .filter((row) =>
      (!query || row.exampleQuery.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
      (!gapFilter || row.gapType === gapFilter) &&
      row.searches >= minVisits,
    )
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sort === 'visits') return b.searches - a.searches || b.priority - a.priority
    if (sort === 'recent') return b.lastSearchedAt.localeCompare(a.lastSearchedAt) || b.priority - a.priority
    return b.priority - a.priority || b.searches - a.searches || b.lastSearchedAt.localeCompare(a.lastSearchedAt)
  })
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const paramsFor = (nextPage?: number) => {
    const params = new URLSearchParams()
    params.set('days', String(days))
    if (query) params.set('q', query)
    if (gapFilter) params.set('gap', gapFilter)
    if (minVisits > 1) params.set('minVisits', String(minVisits))
    if (sort !== 'priority') params.set('sort', sort)
    if (nextPage && nextPage > 1) params.set('page', String(nextPage))
    return `/search/insights?${params.toString()}`
  }
  const hasFilters = !!query || !!gapFilter || minVisits > 1 || sort !== 'priority'

  return (
    <div className="flex flex-col gap-5">
      <form
        action="/search/insights"
        method="get"
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Filter failed queries"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Date range
          <select
            name="days"
            defaultValue={String(days)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {RANGES.map((range) => (
              <option key={range} value={range}>
                {range === 1 ? 'Last 24 hours' : `Last ${range} days`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Query
          <Input name="q" type="search" defaultValue={query} placeholder="Filter queries" maxLength={200} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Gap type
          <select
            name="gap"
            defaultValue={gapFilter}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All gaps</option>
            <option value="content_gap">Content gap</option>
            <option value="search_gap">Search gap</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Minimum visits
          <select
            name="minVisits"
            defaultValue={String(minVisits)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {MIN_VISIT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count === 1 ? 'Any visits' : `${count}+ visits`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Sort by
          <select
            name="sort"
            defaultValue={sort}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="priority">Priority</option>
            <option value="visits">Most visits</option>
            <option value="recent">Recently searched</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply filters</Button>
          {hasFilters && (
            <Button asChild variant="outline">
              <Link href={`/search/insights?days=${days}`}>Clear</Link>
            </Button>
          )}
        </div>
      </form>
      {pageRows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          {hasFilters
            ? 'No failed queries match these filters. Adjust or clear the filters above.'
            : 'No failed queries in this period. Searches made on the search page appear here.'}
        </p>
      ) : (
        <TooltipProvider>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Query</th>
                <th className="px-3 py-2 font-medium">Gap</th>
                <th className="px-3 py-2 text-right font-medium">Visits</th>
                <th className="px-3 py-2 text-right font-medium">Templates</th>
                <th className="px-3 py-2 text-right font-medium">Direct</th>
                <th className="px-3 py-2 text-right font-medium">Partial</th>
                <th className="px-3 py-2 text-right font-medium">Occasion only</th>
                <th className="px-3 py-2 text-right font-medium">Top relevance</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.normalizedQuery} className="border-t align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/search?q=${encodeURIComponent(r.exampleQuery)}&debug=1`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.exampleQuery}
                    </Link>
                    {r.unknownWords.length > 0 && (
                      <p className="text-muted-foreground text-xs">Unknown words: {r.unknownWords.join(', ')}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={r.gapType === 'content_gap' ? 'default' : 'secondary'}>
                      {r.gapType === 'content_gap' ? 'Content gap' : 'Search gap'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.searches}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgResults)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgDirect)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgPartial)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgOccasionOnly)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avgRelevance === null ? '–' : `${Math.round(r.avgRelevance * 100)}%`}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" aria-label="Collection direction">
                            <InfoIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64 whitespace-normal text-left">
                          <span className="font-semibold">Collection direction</span>
                          <p>{collectionDirection(r)}</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.reasons).map(([reason, count]) => (
                          <span key={reason} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                            {REASON_LABELS[reason] ?? reason} · {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </TooltipProvider>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs tabular-nums">
          {sortedRows.length === 0
            ? 'No failed queries'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sortedRows.length)} of ${sortedRows.length.toLocaleString()}`}
        </p>
        <Pagination
          page={page}
          totalPages={totalPages}
          label="Failed query pages"
          hrefForPage={(nextPage) => paramsFor(nextPage)}
        />
      </div>
    </div>
  )
}
