import { CalculatorIcon, CircleAlertIcon, InfoIcon } from 'lucide-react'
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
import type { CountExplanation } from '@/lib/search/failed-query-checks'
import { FAILURE_RULES } from '@/lib/search/failed-queries'
import { cn } from '@/lib/utils'

const n = (value: number) => (Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1))

/** Failure reasons: the short label on the row and what it means, for the Explain numbers panel. */
export const REASON_INFO: Record<string, { label: string; meaning: string }> = {
  zero_results: { label: 'No results', meaning: 'The search showed nothing at all.' },
  no_exact_match: { label: 'No exact match', meaning: 'Cards were shown, but none has everything asked (Direct is 0).' },
  few_exact_matches: {
    label: 'Few exact matches',
    meaning: `Fewer than ${FAILURE_RULES.fewExactMatches} cards have everything asked.`,
  },
  low_relevance: {
    label: 'Weak matches',
    meaning: `Even the best card fits under ${Math.round(FAILURE_RULES.lowRelevance * 100)}%.`,
  },
  reading_removed: { label: 'Reading removed', meaning: 'The user removed part of how search read the query (the × on a tag).' },
  reformulated: {
    label: 'Searched again',
    meaning: `The user typed a different search within ${FAILURE_RULES.reformulateWithinSeconds} seconds.`,
  },
  bounce: { label: 'Quick bounce', meaning: 'The user opened cards but closed them quickly every time.' },
  no_click: { label: 'No click', meaning: 'The user saw the results and clicked nothing.' },
}

export type ExplainRow = {
  query: string
  gapLabel: string
  visits: number
  /** Failed visits per reason. */
  reasons: Record<string, number>
  wordingOnly: boolean
  tagExact: number | null
  /** What to add or improve (collection direction). */
  direction: string
  /** The numbers the search showed when it was logged (average of first searches per visit). */
  logged: { templates: number; direct: number | null; partial: number | null; occasionOnly: number | null; relevance?: number | null }
}

/**
 * "Explain numbers" on a failed query: in plain words why it failed, what search looked for and why the row shows
 * its Direct, Partial and Occasion only numbers, part by part. For testers; the debug view is for developers.
 */
export function CountExplanationDialog({
  row,
  explanation,
  trigger,
  children,
}: {
  row: ExplainRow
  explanation: CountExplanation | null
  /** The button that opens it; defaults to the small "Explain numbers" button of the failed-queries table. */
  trigger?: React.ReactNode
  /** More details, shown after the reasons (the report page adds data hints and a link to the list). */
  children?: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="xs" className="mt-1.5 gap-1">
            <CalculatorIcon aria-hidden /> Explain numbers
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] gap-5 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Why these numbers</DialogTitle>
            <Badge variant="secondary">{row.gapLabel}</Badge>
          </div>
          <DialogDescription className="text-foreground/80 text-base">“{row.query}”</DialogDescription>
        </DialogHeader>
        <Numbers row={row} explanation={explanation} />
        <Reasons row={row} />
        {children}
        {explanation ? (
          <Parts explanation={explanation} />
        ) : (
          <p className="text-muted-foreground text-sm">No reading was saved for this search, so its parts cannot be shown.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[11px]">
          {step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Numbers({ row, explanation: e }: { row: ExplainRow; explanation: CountExplanation | null }) {
  const { logged } = row
  const occasion = e?.occasion
  const tiles = [
    { label: 'Templates', value: logged.templates, note: 'Every card shown, near matches included' },
    {
      label: 'Direct',
      value: logged.direct,
      note: occasion ? `${occasion} cards with every asked part` : 'Cards with every asked part',
      extra: row.tagExact !== null && logged.direct !== null && row.tagExact > logged.direct ? `${n(row.tagExact)} by tags` : null,
    },
    { label: 'Partial', value: logged.partial, note: 'Some of the asked parts, or a nearby occasion' },
    { label: 'Occasion only', value: logged.occasionOnly, note: occasion ? `${occasion} cards with none of the parts` : 'No occasion understood' },
  ]
  const relevance = logged.relevance === undefined ? undefined : logged.relevance === null ? '–' : `${Math.round(logged.relevance * 100)}%`
  return (
    <Section step={1} title="The numbers">
      <div className={cn('grid grid-cols-2 gap-2', relevance === undefined ? 'sm:grid-cols-4' : 'sm:grid-cols-5')}>
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-0.5 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs">{t.label}</span>
            <span className="text-2xl font-semibold tabular-nums">{t.value === null ? '–' : n(t.value)}</span>
            {'extra' in t && t.extra && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t.extra}</span>}
            <span className="text-muted-foreground text-xs leading-snug">{t.note}</span>
          </div>
        ))}
        {relevance !== undefined && (
          <div className="flex flex-col gap-0.5 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs">Top relevance</span>
            <span className="text-2xl font-semibold tabular-nums">{relevance}</span>
            <span className="text-muted-foreground text-xs leading-snug">How well the best card fits</span>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">Templates = Direct + Partial + Occasion only.</p>
    </Section>
  )
}

function Reasons({ row }: { row: ExplainRow }) {
  const entries = Object.entries(row.reasons)
  return (
    <Section step={2} title={entries.length ? 'Why it counts as failed' : 'Why it is not failed'}>
      <ul className="divide-y rounded-lg border">
        {entries.length === 0 && (
          <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">No gap: the search worked</span>
              <span className="text-muted-foreground text-xs">
                {FAILURE_RULES.fewExactMatches} or more cards have everything asked, and the best card fits{' '}
                {Math.round(FAILURE_RULES.lowRelevance * 100)}% or more.
              </span>
            </div>
            <Badge variant="outline" className="shrink-0">Passed</Badge>
          </li>
        )}
        {entries.map(([reason, count]) => (
          <li key={reason} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{REASON_INFO[reason]?.label ?? reason}</span>
              <span className="text-muted-foreground text-xs">{REASON_INFO[reason]?.meaning}</span>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {count} of {row.visits} {row.visits === 1 ? 'visit' : 'visits'}
            </Badge>
          </li>
        ))}
        {row.wordingOnly && (
          <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">Typed words not on cards</span>
              <span className="text-muted-foreground text-xs">
                Cards fit every understood tag; only a typed word a tag already covers (like “toddler”) is not printed on
                them.
              </span>
            </div>
            <Badge variant="secondary" className="shrink-0">Note, not a failure</Badge>
          </li>
        )}
      </ul>
      <p className="bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
        <span className="font-medium">What to do: </span>
        {row.direction}
      </p>
      <p className="text-muted-foreground text-xs">
        A visit = one person searching this query (repeats within {FAILURE_RULES.visitMinutes} minutes count once), or one
        report capture. Opening a template makes the visit a success, whatever the reasons.
      </p>
    </Section>
  )
}

function Parts({ explanation: e }: { explanation: CountExplanation }) {
  const blocker = [...e.parts].sort((a, b) => b.missingOnly - a.missingOnly)[0]
  const pool = e.occasion ? `${n(e.occasionCards)} ${e.occasion} cards` : `${n(e.occasionCards)} templates`
  const showCallout = e.parts.length > 0 && !!blocker && e.direct < FAILURE_RULES.fewExactMatches
  return (
    <Section step={3} title="What search understood, part by part">
      <div className="flex flex-wrap gap-1.5">
        {e.occasion ? <Badge>{e.occasion} · occasion</Badge> : <Badge variant="outline">No occasion</Badge>}
        {e.parts.map((part) => (
          <Badge key={part.label} variant="secondary" className="font-normal">
            {part.label}
          </Badge>
        ))}
      </div>
      {e.parts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing besides the occasion, so every card of the occasion counts as Direct.</p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            Counted among the {pool} search can show{e.occasion ? '' : ' (no occasion understood, so all templates)'}.{' '}
            <b>Missing only this</b> = cards that have every other part, so this part alone keeps them out of Direct.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Asked part</th>
                  <th className="w-[38%] px-3 py-2 font-medium">Cards that have it</th>
                  <th className="px-3 py-2 text-right font-medium">Missing only this</th>
                </tr>
              </thead>
              <tbody>
                {e.parts.map((part) => {
                  const isBlocker = showCallout && part === blocker && part.missingOnly > 0
                  const share = e.occasionCards ? Math.max(part.have ? 2 : 0, Math.round((part.have / e.occasionCards) * 100)) : 0
                  return (
                    <tr key={part.label} className={cn('border-t', isBlocker && 'bg-amber-50 dark:bg-amber-950/40')}>
                      <td className="px-3 py-2">
                        {part.label}
                        {part.coveredBy && (
                          <span className="text-muted-foreground block text-xs">A tag already covers this word</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="w-12 text-right tabular-nums">{n(part.have)}</span>
                        </div>
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', isBlocker && 'font-semibold')}>
                        {part.missingOnly ? n(part.missingOnly) : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {showCallout && (
        <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {e.direct === 0 ? 'No card has every asked part. ' : `Only ${n(e.direct)} ${e.direct === 1 ? 'card has' : 'cards have'} every asked part. `}
            {blocker.missingOnly > 0
              ? `Closest: ${n(blocker.missingOnly)} ${blocker.missingOnly === 1 ? 'card has' : 'cards have'} everything except “${blocker.label}”.`
              : 'No card is one part away; several parts are missing together.'}
            {blocker.missingOnly > 0 && blocker.coveredBy && ' That part is only a typed word a tag already covers, so these cards fit.'}
          </span>
        </p>
      )}
      {!e.occasion && (
        <p className="text-muted-foreground flex gap-1.5 text-xs">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          With no occasion understood, search narrows its results further, so these counts can differ from the numbers
          above.
        </p>
      )}
    </Section>
  )
}
