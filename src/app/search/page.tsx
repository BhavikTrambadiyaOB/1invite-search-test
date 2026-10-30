import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { FilterSidebar } from '@/components/search/filter-sidebar'
import { MobileFilters } from '@/components/search/mobile-filters'
import { RefineTags } from '@/components/search/refine-tags'
import { ResultsFooter } from '@/components/search/results-footer'
import { ResultsGrid } from '@/components/search/results-grid'
import { SearchBox } from '@/components/search/search-box'
import { SearchSession } from '@/components/search/search-session'
import { Skeleton } from '@/components/ui/skeleton'
import { searchTemplates } from '@/lib/search/search-templates'
import type { SearchIntent } from '@/lib/search/types'
import { activeFilterCount, NO_FILTERS, parseSearchParams, searchHref, type SearchState } from '@/lib/search/url'

export const metadata: Metadata = {
  title: 'Template Search',
  description: 'Find the right invitation template in one search.',
}

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8">
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <SearchHeader searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

type Params = PageProps<'/search'>['searchParams']

async function SearchHeader({ searchParams }: { searchParams: Params }) {
  const state = parseSearchParams(await searchParams)
  // The key resets the input when the query in the URL changes (e.g. back button).
  return <SearchBox key={state.query} initialQuery={state.query} debug={state.debug} />
}

async function SearchResults({ searchParams }: { searchParams: Params }) {
  const state = parseSearchParams(await searchParams)
  const response = await searchTemplates({ query: state.query, filters: state.filters, page: state.page, ignore: state.ignore })
  const filterCount = activeFilterCount(state.filters)
  const sidebar = <FilterSidebar state={state} response={response} />

  const grid = (
    <ResultsGrid results={response.results} offset={(response.page - 1) * response.pageSize} debug={state.debug} />
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block" aria-label="Filters">
        {sidebar}
      </aside>

      <section className="flex min-w-0 flex-col gap-5" aria-label="Results">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <RefineTags state={state} response={response} />
          </div>
          <MobileFilters activeCount={filterCount}>{sidebar}</MobileFilters>
        </div>

        {response.total === 0 ? (
          <EmptyState state={state} />
        ) : state.query ? (
          <SearchSession
            payload={{
              query: state.query,
              filters: state.filters,
              page: response.page,
              intent: response.intent,
              resultCount: response.total,
              exactCount: response.exactTotal,
              topScore: response.results[0]?.debug.relevance ?? null,
              ignored: state.ignore,
            }}
          >
            {grid}
          </SearchSession>
        ) : (
          grid
        )}

        {response.total === 0 && state.query && (
          // Zero-result searches are logged too, so they show up as failed queries.
          <SearchSession
            payload={{
              query: state.query,
              filters: state.filters,
              page: 1,
              intent: response.intent,
              resultCount: 0,
              exactCount: 0,
              topScore: null,
              ignored: state.ignore,
            }}
          >
            {null}
          </SearchSession>
        )}

        {response.total > 0 && <ResultsFooter state={state} response={response} />}

        {state.debug && <DebugPanel intent={response.intent} />}
      </section>
    </div>
  )
}

function EmptyState({ state }: { state: SearchState }) {
  const hasFilters = activeFilterCount(state.filters) > 0
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">No templates match this search.</p>
      <p className="text-muted-foreground max-w-md text-sm">
        {hasFilters
          ? 'Try removing a filter, or search with fewer words.'
          : 'Try a broader search, such as the occasion only. This search has been recorded so the team can add matching designs.'}
      </p>
      {hasFilters && (
        <Link
          href={searchHref(state, { filters: NO_FILTERS })}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Clear all filters
        </Link>
      )}
    </div>
  )
}

function DebugPanel({ intent }: { intent: SearchIntent }) {
  return (
    <details open className="bg-muted/50 rounded-lg border p-4 text-xs">
      <summary className="cursor-pointer font-medium">Parsed intent (debug)</summary>
      <pre className="mt-2 overflow-x-auto">{JSON.stringify(intent, null, 2)}</pre>
    </details>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="hidden flex-col gap-3 lg:flex">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[5/7] w-full" />
        ))}
      </div>
    </div>
  )
}
