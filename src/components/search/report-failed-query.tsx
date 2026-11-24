import Link from 'next/link'
import { CalculatorIcon } from 'lucide-react'
import { CountExplanationDialog } from '@/components/search/count-explanation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getReportFailedQuery } from '@/lib/search/failed-queries'
import { explainCounts, missingTagHints } from '@/lib/search/failed-query-checks'
import { collectionDirection, GAP_BADGE, GAP_CLASS, GAP_LABELS } from '@/lib/search/failed-query-gaps'
import { cn } from '@/lib/utils'

/**
 * The failed-query check of this report's search, as a header button that opens Explain numbers: gap, reasons,
 * the logged numbers, what to do, data hints and a link to the row on the failed-queries page. Same judgement as
 * that page, so testers need not filter its list for one query.
 */
export async function ReportFailedQuery({ reportId, version, phase }: { reportId: number; version: number; phase: number }) {
  const row = await getReportFailedQuery(reportId)
  if (!row) {
    return (
      <Button
        variant="outline"
        disabled
        title={`Not logged yet. Run: npm run search:report:log -- --version=${version} --phase=${phase}`}
      >
        <CalculatorIcon aria-hidden /> Explain numbers
      </Button>
    )
  }
  const [hints, explanation] = await Promise.all([
    missingTagHints(row.exampleIntent),
    explainCounts(row.exampleIntent, row.normalizedQuery),
  ])
  const listHref = `/search/insights?q=${encodeURIComponent(row.exampleQuery)}&v=${version}&phase=${phase}`

  return (
    <CountExplanationDialog
      explanation={explanation}
      trigger={
        <Button variant="outline" className="gap-2">
          <CalculatorIcon aria-hidden /> Explain numbers
          <Badge variant={GAP_BADGE[row.gapType]} className={cn('pointer-events-none', GAP_CLASS[row.gapType])}>
            {GAP_LABELS[row.gapType]}
          </Badge>
        </Button>
      }
      row={{
        query: row.exampleQuery,
        gapLabel: GAP_LABELS[row.gapType],
        visits: row.searches,
        reasons: row.reasons,
        wordingOnly: row.wordingOnly,
        tagExact: row.tagExact,
        direction: collectionDirection(row),
        logged: {
          templates: row.avgResults,
          direct: row.avgDirect,
          partial: row.avgPartial,
          occasionOnly: row.avgOccasionOnly,
          relevance: row.avgRelevance,
        },
      }}
    >
      {(row.unknownWords.length > 0 || hints.length > 0) && (
        <ul className="flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-xs">
          {row.unknownWords.length > 0 && (
            <li className="text-muted-foreground">Unknown words: {row.unknownWords.join(', ')}</li>
          )}
          {hints.map((h) => (
            <li key={`${h.kind}-${h.id}`} className="text-amber-700 dark:text-amber-400">
              {h.count} {h.count === 1 ? 'card names' : 'cards name'} {h.label} but {h.count === 1 ? 'is' : 'are'} not tagged
              with this {h.kind}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Judged on the current search logged{' '}
          {new Date(row.lastSearchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Nobody
          clicked a report search, so No click and Quick bounce do not apply.
        </span>
        <Link href={listHref} className="text-foreground font-medium underline-offset-4 hover:underline">
          Open in Failed queries
        </Link>
      </p>
    </CountExplanationDialog>
  )
}
