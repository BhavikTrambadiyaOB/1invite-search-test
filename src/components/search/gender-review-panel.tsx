'use client'

import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { GENDER_LABELS, GENDERS, type Gender, type GenderReviewRow, type TemplateMeta } from '@/lib/search/gender-review-types'
import { cn } from '@/lib/utils'

const GENDER_STYLES: Record<Gender, string> = {
  girl: 'bg-pink-50 text-pink-800 border-pink-200',
  boy: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-muted text-foreground',
}
const KEYS: Record<Gender, string> = { girl: 'G', boy: 'B', neutral: 'N' }

const words = (value: string) => value.replaceAll('_', ' ')
const genderLabel = (value: string | null) => (value && value in GENDER_LABELS ? GENDER_LABELS[value as Gender] : 'Neutral')

/**
 * The gender review, one card at a time: the card, its gender now / from the AI / from you, and every tag search
 * uses today. "Skip" keeps the AI answer; Girl / Boy / Neutral saves your own. Keys: S, G, B, N, and U to undo the
 * last card. After saving, the next card loads.
 */
export function GenderReviewPanel({
  row,
  last,
  prevHref,
  nextHref,
  steppingThrough,
}: {
  row: GenderReviewRow
  /** The card reviewed last (for Undo), unless it is this card. */
  last: GenderReviewRow | null
  prevHref: string | null
  nextHref: string | null
  /** Reviewed / all lists: after saving, move to the next card instead of reloading the same place. */
  steppingThrough: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<Gender | 'skip' | 'undo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const post = useCallback(async (templateId: number, finalGender: Gender | null) => {
    const response = await fetch('/api/search/gender-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId, finalGender }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error ?? 'Could not save')
    }
  }, [])

  const decide = useCallback(
    async (answer: Gender | 'skip') => {
      if (saving) return
      setSaving(answer)
      setError(null)
      try {
        await post(row.templateId, answer === 'skip' ? row.aiGender : answer)
        if (steppingThrough && nextHref) router.push(nextHref)
        else router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save')
      } finally {
        setSaving(null)
      }
    },
    [nextHref, post, router, row.aiGender, row.templateId, saving, steppingThrough],
  )

  const undoLast = useCallback(async () => {
    if (!last || saving) return
    setSaving('undo')
    setError(null)
    try {
      await post(last.templateId, null)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not undo')
    } finally {
      setSaving(null)
    }
  }, [last, post, router, saving])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const key = event.key.toLowerCase()
      if (key === 's') decide('skip')
      else if (key === 'g') decide('girl')
      else if (key === 'b') decide('boy')
      else if (key === 'n') decide('neutral')
      else if (key === 'u') undoLast()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, undoLast])

  const searchNow = genderLabel(row.meta.gender)

  return (
    <div className="flex flex-col gap-4">
      {last && (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
          <span className="min-w-0 truncate">
            Last: <span className="font-mono">#{last.templateId}</span> {last.name} →{' '}
            <b>{genderLabel(last.finalGender)}</b>
            {last.finalGender === last.aiGender ? ' (AI answer)' : ` (AI said ${GENDER_LABELS[last.aiGender]})`}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={undoLast} disabled={saving !== null} className="h-7 gap-1">
            {saving === 'undo' ? <Spinner /> : <RotateCcw className="size-3.5" aria-hidden />} Undo <kbd className="text-muted-foreground">U</kbd>
          </Button>
        </div>
      )}

      <article className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <a
          href={row.previewUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          title="Open the full image"
          className="bg-muted relative mx-auto block w-full max-w-md overflow-hidden rounded-xl border lg:max-w-none"
        >
          {row.previewUrl ? (
            <img src={row.previewUrl} alt={row.name} className="max-h-[78vh] w-full object-contain" />
          ) : (
            <span className="text-muted-foreground flex h-96 items-center justify-center text-sm">No preview</span>
          )}
          <ExternalLink className="bg-background/90 absolute top-2 right-2 size-7 rounded-full p-1.5 shadow-sm" aria-hidden />
        </a>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <p className="text-muted-foreground font-mono text-xs">#{row.templateId}</p>
            <h2 className="text-lg leading-snug font-semibold">{row.name}</h2>
          </div>

          <section className="grid grid-cols-3 gap-2" aria-label="Gender">
            <GenderBox title="Search uses now" value={searchNow} note="current data" />
            <GenderBox
              title="AI says (new)"
              value={GENDER_LABELS[row.aiGender]}
              note={`${Math.round(row.confidence * 100)}% sure`}
              tone={row.aiGender}
            />
            <GenderBox
              title="Your answer"
              value={row.finalGender ? GENDER_LABELS[row.finalGender] : '—'}
              note={row.finalGender ? (row.finalGender === row.aiGender ? 'same as AI' : 'differs from AI') : 'not reviewed'}
              tone={row.finalGender ?? undefined}
            />
          </section>
          <p className="text-muted-foreground -mt-2 text-sm">
            <span className="text-foreground font-medium">AI reason:</span> {row.reason}
          </p>

          <section className="flex flex-col gap-2" aria-label="Your answer">
            <Button type="button" size="lg" onClick={() => decide('skip')} disabled={saving !== null} className="justify-between">
              <span className="flex items-center gap-2">
                {saving === 'skip' && <Spinner />}
                Skip: keep AI answer ({GENDER_LABELS[row.aiGender]})
              </span>
              <kbd className="text-primary-foreground/70 text-xs">S</kbd>
            </Button>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Change gender for template ${row.templateId}`}>
              {GENDERS.map((gender) => (
                <Button
                  key={gender}
                  type="button"
                  variant="outline"
                  onClick={() => decide(gender)}
                  disabled={saving !== null}
                  aria-pressed={row.finalGender === gender}
                  className={cn('justify-between', row.finalGender === gender && 'ring-primary ring-2')}
                >
                  <span className="flex items-center gap-1.5">
                    {saving === gender && <Spinner />}
                    {GENDER_LABELS[gender]}
                  </span>
                  <kbd className="text-muted-foreground text-xs">{KEYS[gender]}</kbd>
                </Button>
              ))}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {(prevHref || nextHref) && (
              <div className="flex items-center justify-between gap-2 text-sm">
                {prevHref ? (
                  <Link href={prevHref} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <ChevronLeft className="size-4" aria-hidden /> Previous
                  </Link>
                ) : (
                  <span />
                )}
                {nextHref && (
                  <Link href={nextHref} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    Next without saving <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            )}
          </section>

          <MetaTable meta={row.meta} />
        </div>
      </article>
    </div>
  )
}

function GenderBox({ title, value, note, tone }: { title: string; value: string; note: string; tone?: Gender }) {
  return (
    <div className={cn('rounded-lg border p-2.5', tone && GENDER_STYLES[tone])}>
      <p className="text-[11px] leading-tight opacity-80">{title}</p>
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[11px] opacity-80">{note}</p>
    </div>
  )
}

/** Every tag search uses for this template today. */
function MetaTable({ meta }: { meta: TemplateMeta }) {
  const rows: [string, string | string[] | null][] = [
    ['Occasion', meta.occasion ? words(meta.occasion) : null],
    ['Also fits', meta.alsoOccasions.map(words)],
    ['Age', meta.milestone ? String(meta.milestone) : null],
    ['Audience', meta.audience],
    ['Card type', meta.docType ? words(meta.docType) : null],
    ['Format', meta.format],
    ['Themes', meta.themes.map(words)],
    ['Elements', meta.assets.map(words)],
    ['Styles', meta.styles.map(words)],
    ['Colors', meta.colors.map(words)],
    ['Shades', meta.colorShades],
    ['Moods', meta.moods],
    ['Languages', meta.languages],
    ['Photo', meta.hasPhoto ? 'with photo' : 'no photo'],
    ['Price', meta.isFree ? 'Free' : 'PRO'],
  ]
  return (
    <section aria-label="Current metadata" className="rounded-lg border">
      <h3 className="border-b px-3 py-2 text-sm font-medium">Current metadata (what search uses now)</h3>
      <dl className="divide-y text-sm">
        {rows.map(([label, value]) => {
          const values = Array.isArray(value) ? value : value ? [value] : []
          return (
            <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 px-3 py-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex flex-wrap gap-1">
                {values.length ? (
                  values.map((v, i) => (
                    <Badge key={`${v}-${i}`} variant="outline" className="font-normal">
                      {v}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
