import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { GenderReviewPanel } from '@/components/search/gender-review-panel'
import { SearchNav } from '@/components/search/search-nav'
import { Skeleton } from '@/components/ui/skeleton'
import {
  GENDER_LABELS,
  GENDERS,
  genderReviewFiltersFromParams,
  genderReviewHref,
  getGenderReviewItem,
  getGenderReviewSummary,
  getLastReviewed,
  type GenderReviewFilters,
} from '@/lib/search/gender-review'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Gender Review',
  description: 'Check the AI gender answers for birthday templates one by one before they change the template data.',
}

export default function GenderReviewPage({ searchParams }: PageProps<'/search/gender-review'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchNav active="gender" />
          <BackLink href="/search">Back to search</BackLink>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gender review</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          The AI looked at each birthday card tagged <b>neutral</b> and said whether it is made for a girl, a boy or
          anyone. Check each card and pick your answer; it is saved right away. Answers are kept in a separate table:
          the template data used by search does <b>not</b> change until the reviewed answers are applied. One card at a
          time: <b>Skip</b> keeps the AI answer, Girl / Boy / Neutral saves your own, and the next card loads. Keys: S, G,
          B, N, and U to undo the last card.
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Add AI answers with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">npm run search:check-gender -- --review</code> (all cards not
          checked yet) or <code className="bg-muted rounded px-1.5 py-0.5">--review --sample 50</code>.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Review searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Review({ searchParams }: { searchParams: PageProps<'/search/gender-review'>['searchParams'] }) {
  const sp = await searchParams
  const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const filters = genderReviewFiltersFromParams((key) => param(sp[key]))
  // Answers change as people review, so the list is read per request.
  await connection()
  const [summary, current, last] = await Promise.all([
    getGenderReviewSummary(),
    getGenderReviewItem(filters),
    getLastReviewed(),
  ])
  const percent = summary.total ? Math.round((summary.reviewed / summary.total) * 100) : 0
  // "To review": a saved card leaves the list, so the first card is always the next one. Reviewed / all lists keep
  // their cards, so they are stepped through by position.
  const steppingThrough = filters.status !== 'pending'
  const prevHref = steppingThrough && current.position > 1 ? genderReviewHref(filters, current.position - 1) : null
  const nextHref = current.position < current.total ? genderReviewHref(filters, current.position + 1) : null

  return (
    <>
      <section className="flex flex-col gap-2 rounded-xl border p-4" aria-label="Progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {summary.reviewed} of {summary.total} reviewed <span className="text-muted-foreground">({percent}%)</span>
          </p>
          <p className="text-muted-foreground text-xs">
            {summary.changed} where your answer differs from the AI
          </p>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-muted-foreground text-xs">
          AI said:{' '}
          {GENDERS.map((g) => `${GENDER_LABELS[g]} ${summary.byAi[g].all} (${summary.byAi[g].reviewed} reviewed)`).join(' · ')}
        </p>
      </section>

      <nav className="flex flex-col gap-2" aria-label="Filters">
        <FilterRow
          label="Status"
          options={[
            { label: 'To review', next: { status: 'pending' } },
            { label: 'Reviewed', next: { status: 'reviewed' } },
            { label: 'All', next: { status: 'all' } },
          ]}
          filters={filters}
          isActive={(next) => next.status === filters.status}
        />
        <FilterRow
          label="AI said"
          options={[
            { label: 'Any', next: { ai: undefined } },
            ...GENDERS.map((g) => ({ label: GENDER_LABELS[g], next: { ai: g } })),
          ]}
          filters={filters}
          isActive={(next) => next.ai === filters.ai}
        />
        <FilterRow
          label="AI sure"
          options={[
            { label: 'Any', next: { minConfidence: undefined } },
            { label: '85%+', next: { minConfidence: 0.85 } },
            { label: '90%+', next: { minConfidence: 0.9 } },
          ]}
          filters={filters}
          isActive={(next) => next.minConfidence === filters.minConfidence}
        />
      </nav>

      <p className="text-muted-foreground text-xs tabular-nums">
        {current.total === 0
          ? 'No cards match these filters'
          : `Card ${current.position} of ${current.total} · girl and boy answers first, surest first`}
      </p>

      {current.item ? (
        <GenderReviewPanel
          key={current.item.templateId}
          row={current.item}
          last={last && last.templateId !== current.item.templateId ? last : null}
          prevHref={prevHref}
          nextHref={nextHref}
          steppingThrough={steppingThrough}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
          <p className="text-muted-foreground">
            {filters.status === 'pending' ? 'Nothing left to review with these filters.' : 'No cards match these filters.'}
          </p>
          {filters.status === 'pending' && (
            <Link href={genderReviewHref({ ...filters, status: 'reviewed', position: 1 })} className="underline">
              See the reviewed cards
            </Link>
          )}
        </div>
      )}
    </>
  )
}

function FilterRow({
  label,
  options,
  filters,
  isActive,
}: {
  label: string
  options: { label: string; next: Partial<GenderReviewFilters> }[]
  filters: GenderReviewFilters
  isActive: (next: GenderReviewFilters) => boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground w-16 text-xs">{label}</span>
      {options.map((option) => {
        const next = { ...filters, ...option.next, position: 1 }
        const active = isActive(next)
        return (
          <Link
            key={option.label}
            href={genderReviewHref(next)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
