import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { BackLink } from '@/components/search/back-link'
import { Pagination } from '@/components/search/pagination'
import { SearchNav } from '@/components/search/search-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  COVERAGE_STATUS_HELP,
  COVERAGE_STATUS_LABELS,
  COVERAGE_STATUSES,
  coverageFilterParams,
  coverageFiltersFromParams,
  getCoverageSummary,
  listCoverageLists,
  listCoverageTags,
  listCoverageWords,
  listQueryCoverage,
  tagText,
  type CoverageFilters,
  type CoverageStatus,
} from '@/lib/search/query-coverage'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Tag Coverage',
  description: 'Which words of user search queries the search rules turn into tags.',
}

const STATUS_STYLES: Record<CoverageStatus, string> = {
  full: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  partial: 'bg-sky-50 text-sky-800 border-sky-200',
  text_only: 'bg-amber-50 text-amber-800 border-amber-200',
  none: 'bg-rose-50 text-rose-800 border-rose-200',
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

export default function TagCoveragePage({ searchParams }: PageProps<'/search/coverage'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchNav active="coverage" />
          <BackLink href="/search">Back to search</BackLink>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tag coverage</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          For each user search query: the tags the search rules read from it, and the words that are not tags.
          Only the rules are used here, with <b>no AI and no embeddings</b>, so this is what search understands on
          its own. Words that are not tags are split into words some template text contains (search can still match
          them as text) and words no template contains.
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Import or refresh a sheet with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">npm run search:coverage -- &quot;queries.csv&quot;</code>.
          It runs in seconds, makes no AI or live-server calls, and re-running the same file replaces its results.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Coverage searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Coverage({ searchParams }: { searchParams: PageProps<'/search/coverage'>['searchParams'] }) {
  const sp = await searchParams
  const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const filters = coverageFiltersFromParams((key) => param(sp[key]))
  const rawPage = Number(param(sp.page))
  await connection()

  const lists = await listCoverageLists()
  const list = lists.find((l) => l.id === filters.list) ?? lists[0]
  if (!list) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-sm">
        No query list yet. Import one with{' '}
        <code className="bg-muted rounded px-1.5 py-0.5">npm run search:coverage -- &quot;queries.csv&quot;</code>.
      </div>
    )
  }

  const [summary, result, words, tags] = await Promise.all([
    getCoverageSummary(list.id),
    listQueryCoverage(list.id, filters, Number.isFinite(rawPage) ? rawPage : 1),
    listCoverageWords(list.id, 40),
    listCoverageTags(list.id, 30),
  ])

  const base: CoverageFilters = { ...filters, list: list.id }
  const href = (change: Partial<CoverageFilters>, page = 1) => {
    const params = coverageFilterParams({ ...base, ...change })
    if (page > 1) params.set('page', String(page))
    return `/search/coverage?${params.toString()}`
  }
  const exportSearch = coverageFilterParams(base).toString()
  const hasFilters = !!(filters.status || filters.query || filters.word || filters.tag || filters.zero)
  const percent = (n: number) => (summary.total ? `${((n / summary.total) * 100).toFixed(1)}%` : '0%')

  return (
    <div className="flex flex-col gap-6">
      {/* Coverage at a glance; each card filters the table. */}
      <section aria-label="Coverage summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {COVERAGE_STATUSES.map((status) => (
          <Link
            key={status}
            href={href({ status: filters.status === status ? undefined : status, zero: undefined })}
            aria-current={filters.status === status ? 'true' : undefined}
            className={cn(
              'flex flex-col gap-1 rounded-xl border p-4 transition-shadow hover:shadow-sm',
              STATUS_STYLES[status],
              filters.status === status && 'ring-2 ring-current/40',
            )}
          >
            <span className="text-sm font-medium">{COVERAGE_STATUS_LABELS[status]}</span>
            <span className="text-2xl font-semibold tabular-nums">{summary.byStatus[status].toLocaleString()}</span>
            <span className="text-xs opacity-80">
              {percent(summary.byStatus[status])} · {COVERAGE_STATUS_HELP[status]}
            </span>
          </Link>
        ))}
        <Link
          href={href({ zero: filters.zero ? undefined : true, status: undefined })}
          aria-current={filters.zero ? 'true' : undefined}
          className={cn(
            'flex flex-col gap-1 rounded-xl border bg-background p-4 transition-shadow hover:shadow-sm',
            filters.zero && 'ring-primary/40 ring-2',
          )}
        >
          <span className="text-sm font-medium">No template has all its tags</span>
          <span className="text-2xl font-semibold tabular-nums">{summary.zeroTemplates.toLocaleString()}</span>
          <span className="text-muted-foreground text-xs">
            {percent(summary.zeroTemplates)} · Tags were read, but no local template carries all of them.
          </span>
        </Link>
      </section>

      <form action="/search/coverage" method="get" className="flex flex-col gap-3 rounded-xl border p-4" aria-label="Filter queries">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Query list
            <select name="list" defaultValue={list.id} className={SELECT}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.sourceFile} ({l.queryCount.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Query
            <Input name="q" type="search" defaultValue={filters.query} placeholder="Contains…" maxLength={200} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Coverage
            <select name="status" defaultValue={filters.status ?? ''} className={SELECT}>
              <option value="">All</option>
              {COVERAGE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {COVERAGE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Word that is not a tag
            <Input name="word" defaultValue={filters.word} placeholder="e.g. welcome" maxLength={100} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Tag
            <select name="tag" defaultValue={filters.tag ?? ''} className={SELECT}>
              <option value="">Any</option>
              {filters.tag && !tags.some((t) => t.tag === filters.tag) && <option value={filters.tag}>{filters.tag}</option>}
              {tags.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} ({t.queries.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
        </div>
        {filters.zero && <input type="hidden" name="zero" value="1" />}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Apply filters</Button>
          {hasFilters && (
            <Button asChild variant="outline">
              <Link href={`/search/coverage?list=${list.id}`}>Clear filters</Link>
            </Button>
          )}
          <span className="text-muted-foreground text-xs">
            {result.total.toLocaleString()} of {summary.total.toLocaleString()} queries
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/api/search/coverage/export?${exportSearch}`} download>
                <Download aria-hidden />
                Export queries (CSV)
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/search/coverage/export?list=${list.id}&view=words`} download>
                <Download aria-hidden />
                Export words (CSV)
              </a>
            </Button>
          </div>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Queries" className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="w-12 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Search query</th>
                  <th className="px-3 py-2 font-medium">Coverage</th>
                  <th className="px-3 py-2 font-medium">Tags</th>
                  <th className="px-3 py-2 font-medium">Not tags</th>
                  <th className="px-3 py-2 text-right font-medium" title="Local templates that carry every tag">
                    Templates
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-3 py-8 text-center">
                      No queries match these filters.
                    </td>
                  </tr>
                )}
                {result.rows.map((row) => (
                  <tr key={row.rowNo} className="border-t align-top">
                    <td className="text-muted-foreground px-3 py-2.5 tabular-nums">{row.rowNo}</td>
                    <td className="px-3 py-2.5 font-medium wrap-break-word">
                      <Link href={`/search?q=${encodeURIComponent(row.query)}`} className="hover:underline" title="Open in search">
                        {row.query}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', STATUS_STYLES[row.status])}>
                        {COVERAGE_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.tags.length === 0 && <span className="text-muted-foreground text-xs">None</span>}
                        {row.tags.map((tag) => {
                          const empty = row.emptyTags.includes(tagText(tag))
                          return (
                            <Link
                              key={tagText(tag)}
                              href={href({ tag: tagText(tag) })}
                              title={empty ? 'No local template has this tag' : `Filter by ${tagText(tag)}`}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
                                empty ? 'border-rose-300 bg-rose-50 text-rose-800' : 'bg-muted/40 hover:bg-muted',
                              )}
                            >
                              <span className="text-muted-foreground">{tag.group}</span>
                              {tag.label}
                            </Link>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.textWords.length + row.missingWords.length === 0 && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {row.textWords.map((word) => (
                          <WordChip key={word} word={word} kind="text" href={href({ word })} />
                        ))}
                        {row.missingWords.map((word) => (
                          <WordChip key={word} word={word} kind="missing" href={href({ word })} />
                        ))}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right tabular-nums',
                        row.templatesAllTags === 0 && 'font-semibold text-rose-700',
                      )}
                    >
                      {row.templatesAllTags === null ? '—' : row.templatesAllTags.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            label="Coverage pages"
            hrefForPage={(page) => href({}, page)}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Most common words that are not tags</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              The best candidates for new tags. <WordKey kind="text" /> some template text has it;{' '}
              <WordKey kind="missing" /> no template has it.
            </p>
            <ol className="mt-3 flex flex-col gap-1">
              {words.map((w) => (
                <li key={`${w.kind}:${w.word}`} className="flex items-center justify-between gap-2 text-sm">
                  <WordChip word={w.word} kind={w.kind} href={href({ word: w.word, status: undefined })} />
                  <span className="text-muted-foreground tabular-nums">{w.queries.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Most common tags</h2>
            <ol className="mt-3 flex flex-col gap-1">
              {tags.slice(0, 15).map((t) => (
                <li key={t.tag} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={href({ tag: t.tag })} className="truncate hover:underline">
                    {t.tag}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">{t.queries.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

const WORD_STYLES = {
  text: 'border-amber-300 bg-amber-50 text-amber-900',
  missing: 'border-rose-300 bg-rose-50 text-rose-900 line-through decoration-rose-400/60',
}

function WordChip({ word, kind, href }: { word: string; kind: 'text' | 'missing'; href: string }) {
  return (
    <Link
      href={href}
      title={kind === 'text' ? 'Not a tag; found in some template text' : 'Not a tag; in no template'}
      className={cn('rounded-md border px-1.5 py-0.5 text-xs hover:opacity-80', WORD_STYLES[kind])}
    >
      {word}
    </Link>
  )
}

function WordKey({ kind }: { kind: 'text' | 'missing' }) {
  return <span className={cn('rounded border px-1 text-[11px]', WORD_STYLES[kind])}>{kind === 'text' ? 'amber' : 'red'}</span>
}
