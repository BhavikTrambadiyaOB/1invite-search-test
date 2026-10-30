import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { SearchNav } from '@/components/search/search-nav'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'
import { getFailedQueries } from '@/lib/search/failed-queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Failed Queries',
  description: 'Searches where users did not find a template.',
}

const RANGES = [1, 7, 30, 90] as const

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
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Searches where nobody chose a template, counted once per visit (a session searching a query, with its tag
          taps and filters). Ranked by visits × failure rate. <strong className="text-foreground font-medium">Exact</strong>{' '}
          counts results that fit the occasion and every detail asked: “dinosaur wedding” can show many wedding cards
          and still have no exact match.{' '}
          <strong className="text-foreground font-medium">Content gap</strong>: the search was understood, but designs are
          missing or not good enough. <strong className="text-foreground font-medium">Search gap</strong>: the search was
          not understood, so a synonym or rule is needed.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Report({ searchParams }: { searchParams: PageProps<'/search/insights'>['searchParams'] }) {
  const sp = await searchParams
  // The report covers the time up to now, so it is rendered per request, never prerendered.
  await connection()
  const requested = Number(Array.isArray(sp.days) ? sp.days[0] : sp.days)
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 7
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)

  const [rows, totals] = await Promise.all([
    getFailedQueries({ from, to, limit: 200 }),
    db.query<{ searches: number; sessions: number }>(
      // Visits, like the failure counts: one session searching one query (tag taps and filters included).
      `select count(distinct (session_id, normalized_query))::int searches, count(distinct session_id)::int sessions
         from search_log where created_at >= $1 and normalized_query <> ''`,
      [from],
    ),
  ])
  const failures = rows.reduce((sum, r) => sum + r.failures, 0)
  const { searches, sessions } = totals.rows[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Last</span>
        {RANGES.map((d) => (
          <Link
            key={d}
            href={`/search/insights?days=${d}`}
            className={cn('rounded-full border px-3 py-1', d === days ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
          >
            {d === 1 ? '24 hours' : `${d} days`}
          </Link>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Visits', searches],
          ['Sessions', sessions],
          ['Failed visits', failures],
          ['Failure rate', searches ? `${Math.round((failures / searches) * 100)}%` : '–'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No failed queries in this period. Searches made on the search page appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Query</th>
                <th className="px-3 py-2 font-medium">Gap</th>
                <th className="px-3 py-2 text-right font-medium">Visits</th>
                <th className="px-3 py-2 text-right font-medium">Failed</th>
                <th className="px-3 py-2 text-right font-medium">Avg results</th>
                <th className="px-3 py-2 text-right font-medium">Exact</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                  <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.failureRate * 100)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.avgResults}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.avgExact ?? '–'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(r.reasons).map(([reason, count]) => (
                        <span key={reason} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                          {REASON_LABELS[reason] ?? reason} · {count}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
