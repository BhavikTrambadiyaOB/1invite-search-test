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
import { TooltipProvider } from '@/components/ui/tooltip'
import { FAILURE_RULES, getFailedQueries, getLoggedReportRuns, getReportCaseTypes, type FailedQuery, type GapType } from '@/lib/search/failed-queries'
import {
  applyFailedQueryFilters,
  COLUMNS,
  GAPS,
  failedQueryFiltersFromParams,
  failedQueryHref,
  OPERATORS,
  SORTS,
  sourceOf,
} from '@/lib/search/failed-query-filters'
import { explainCounts, missingTagHints } from '@/lib/search/failed-query-checks'
import { CountExplanationDialog } from '@/components/search/count-explanation'

export const metadata: Metadata = {
  title: 'Failed Queries',
  description: 'Searches where users did not find a template.',
}

const PAGE_SIZE = 50


const GAP_LABELS: Record<GapType, string> = {
  content_gap: 'Content gap',
  search_gap: 'Search gap',
  not_chosen: 'Not chosen',
  no_gap: 'No gap',
}
const GAP_BADGE: Record<GapType, 'default' | 'secondary' | 'outline'> = {
  content_gap: 'default',
  search_gap: 'secondary',
  not_chosen: 'outline',
  no_gap: 'outline',
}
/** "No gap" in green, so passed searches stand apart from the failed ones. */
const GAP_CLASS: Partial<Record<GapType, string>> = {
  no_gap: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
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
  if (query.gapType === 'no_gap') {
    return `Nothing to do: the search worked (${FAILURE_RULES.fewExactMatches}+ exact matches and a strong best card).`
  }
  if (query.gapType === 'not_chosen') {
    return 'Search found fitting templates and ranked a strong match first, but the user did not pick one. Review the designs and their order (taste), not the collection size.'
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
  // The understood-tag recount, when higher: typed words like "toddler" are not printed on cards that fit.
  const directMatches = query.avgDirect === null ? null : Math.max(query.avgDirect, query.tagExact ?? 0)
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8">
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
                    <div>
                      <dt className="text-sm font-medium">Not chosen</dt>
                      <dd className="text-muted-foreground text-sm">
                        Search understood the query, found {FAILURE_RULES.fewExactMatches}+ exact matches and a strong best
                        match, yet the user did not click, bounced or searched again. Review taste and order, not coverage.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium">“by tags” and “Typed words not on cards”</dt>
                      <dd className="text-muted-foreground text-sm">
                        Direct also asks typed words to be printed on the card, even ones a tag already covers (“toddler”
                        = Toddlers audience, “holy cow” = Cow element). The page recounts with those words left to their
                        tag; when that finds enough cards, the search is not marked “No exact match”.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium">Missing tag (amber note)</dt>
                      <dd className="text-muted-foreground text-sm">
                        Cards whose name says an asked theme or element but which are not tagged with it. A data to-do;
                        nothing is changed automatically.
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
  const filters = failedQueryFiltersFromParams((key) => param(sp[key]))
  const [rows, runs, caseTypes] = await Promise.all([
    getFailedQueries({ limit: null, source: sourceOf(filters), includePassed: true }),
    getLoggedReportRuns(),
    getReportCaseTypes(typeof filters.version === 'number' ? filters.version : null),
  ])
  const sortedRows = applyFailedQueryFilters(rows, filters)
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const page = Math.min(filters.page, totalPages)
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Report-only: asked themes and elements some cards name without the tag (the data team's to-do).
  const [hints, explanations] = await Promise.all([
    Promise.all(pageRows.map((row) => missingTagHints(row.exampleIntent))),
    Promise.all(pageRows.map((row) => explainCounts(row.exampleIntent, row.normalizedQuery))),
  ])
  const phases = [...new Set(
    runs.filter((r) => filters.version === 'all' || r.version === filters.version).flatMap((r) => r.phases),
  )].sort((a, b) => a - b)
  const hasFilters = failedQueryHref({ ...filters, page: 1 }) !== '/search/insights'
  const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

  return (
    <div className="flex flex-col gap-5">
      <form
        action="/search/insights"
        method="get"
        className="flex flex-col gap-3 rounded-xl border p-4"
        aria-label="Filter failed queries"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Search query
            <Input name="q" type="search" defaultValue={filters.query} placeholder="Filter queries" maxLength={200} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Version
            <select name="v" defaultValue={String(filters.version)} className={selectClass}>
              <option value="all">All searches</option>
              <option value="live">Search page only</option>
              {runs.map((r) => (
                <option key={r.version} value={r.version}>
                  v{r.version} report
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Phase
            <select name="phase" defaultValue={filters.phase ? String(filters.phase) : ''} className={selectClass}>
              <option value="">All phases</option>
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  Phase {phase}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Case type
            <select name="case" defaultValue={filters.caseType ?? ''} className={selectClass}>
              <option value="">All case types</option>
              {caseTypes.map((caseType) => (
                <option key={caseType} value={caseType}>
                  {caseType}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Gap
            <select name="gap" defaultValue={filters.gap} className={selectClass}>
              {Object.entries(GAPS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Sort by
            <select name="sort" defaultValue={filters.sort} className={selectClass}>
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Number condition</legend>
          <div className="flex flex-wrap items-center gap-2">
            <select name="col" defaultValue={filters.condition?.column ?? ''} aria-label="Column" className={`${selectClass} sm:w-48`}>
              <option value="">Any column</option>
              {Object.entries(COLUMNS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select name="op" defaultValue={filters.condition?.operator ?? '='} aria-label="Comparison" className="border-input bg-background h-9 w-20 rounded-md border px-3 text-sm">
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <Input
              name="val"
              type="number"
              step="any"
              defaultValue={filters.condition ? String(filters.condition.value) : ''}
              placeholder="Number"
              aria-label="Number"
              className="w-28"
            />
            <div className="ml-auto flex gap-2">
              <Button type="submit">Apply filters</Button>
              {hasFilters && (
                <Button asChild variant="outline">
                  <Link href="/search/insights">Clear</Link>
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            For example Direct = 0, Templates &gt;= 100 or Top relevance &lt; 50. Report searches are judged on their
            results only: nobody clicked them, so No click and Quick bounce do not apply.
          </p>
        </fieldset>
      </form>
      {pageRows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          {hasFilters
            ? 'No failed queries match these filters. Adjust or clear the filters above.'
            : 'No failed queries yet. Searches made on the search page and report captures appear here.'}
        </p>
      ) : (
        <TooltipProvider>
          {/* Header row and Query column stay in view while scrolling the 50 rows (down or sideways). */}
          <div className="max-h-[78vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground sticky top-0 z-20 text-left text-xs shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="bg-muted sticky left-0 z-30 min-w-56 px-3 py-2 font-medium shadow-[1px_0_0_var(--border)]">Query</th>
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
              {pageRows.map((r, i) => (
                <tr key={r.normalizedQuery} className="border-t align-top">
                  <td className="bg-background sticky left-0 z-10 min-w-56 px-3 py-2 shadow-[1px_0_0_var(--border)]">
                    <Link
                      href={`/search?q=${encodeURIComponent(r.exampleQuery)}&debug=1`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.exampleQuery}
                    </Link>
                    {r.report && (
                      <Link href={`/search/report/${r.report.id}`} className="text-muted-foreground block text-xs hover:underline">
                        v{r.report.version} · Phase {r.report.phase} report
                      </Link>
                    )}
                    {r.caseTypes.length > 0 && (
                      <p className="text-muted-foreground text-xs">Case type: {r.caseTypes.join(', ')}</p>
                    )}
                    {r.unknownWords.length > 0 && (
                      <p className="text-muted-foreground text-xs">Unknown words: {r.unknownWords.join(', ')}</p>
                    )}
                    {hints[i].map((h) => (
                      <p key={`${h.kind}-${h.id}`} className="text-xs text-amber-700 dark:text-amber-400">
                        {h.count} {h.count === 1 ? 'card names' : 'cards name'} {h.label} but {h.count === 1 ? 'is' : 'are'} not
                        tagged with this {h.kind}
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={GAP_BADGE[r.gapType]} className={GAP_CLASS[r.gapType]}>
                      {GAP_LABELS[r.gapType]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.searches}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgResults)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAverage(r.avgDirect)}
                    {r.tagExact !== null && r.avgDirect !== null && r.tagExact > r.avgDirect && (
                      <span className="text-muted-foreground block text-xs whitespace-nowrap">{r.tagExact} by tags</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgPartial)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAverage(r.avgOccasionOnly)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avgRelevance === null ? '–' : `${Math.round(r.avgRelevance * 100)}%`}
                  </td>
                  <td className="px-3 py-2">
                    <CountExplanationDialog
                      explanation={explanations[i]}
                      row={{
                        query: r.exampleQuery,
                        gapLabel: GAP_LABELS[r.gapType],
                        visits: r.searches,
                        reasons: r.reasons,
                        wordingOnly: r.wordingOnly,
                        tagExact: r.tagExact,
                        direction: collectionDirection(r),
                        logged: { templates: r.avgResults, direct: r.avgDirect, partial: r.avgPartial, occasionOnly: r.avgOccasionOnly },
                      }}
                    />
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
          hrefForPage={(nextPage) => failedQueryHref(filters, nextPage)}
        />
      </div>
    </div>
  )
}
