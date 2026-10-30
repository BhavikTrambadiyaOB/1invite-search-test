/* eslint-disable @next/next/no-img-element */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReportSnapshot } from '@/lib/search/report-types'

function ratio(item: ReportSnapshot['results'][number]) {
  if (item.width && item.height) return `${item.width} / ${item.height}`
  return '5 / 7'
}

type PriceFilter = 'all' | 'free' | 'premium'
type OrientationFilter = 'all' | 'portrait' | 'landscape'
type PhotoFilter = 'all' | 'with'

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Stored results for one side. Cards are one column on a phone, then 2 / 3 / 4 as the screen grows,
 * matching the mobile app. Filters use the metadata saved with newer snapshots; old snapshots keep the
 * plain grid so the page never hides results it cannot classify.
 */
export function ReportGrid({ snapshot }: { snapshot: ReportSnapshot | null }) {
  const [price, setPrice] = useState<PriceFilter>('all')
  const [orientation, setOrientation] = useState<OrientationFilter>('all')
  const [photo, setPhoto] = useState<PhotoFilter>('all')

  const results = snapshot?.results ?? []
  const hasPrice = results.some((item) => typeof item.isFree === 'boolean')
  const hasOrientation = results.some((item) => typeof item.isPortrait === 'boolean')
  const hasPhoto = results.some((item) => typeof item.hasPhoto === 'boolean')
  const canFilter = hasPrice || hasOrientation || hasPhoto

  const filtered = useMemo(() => {
    return results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (price !== 'all' && item.isFree !== (price === 'free')) return false
        if (orientation !== 'all' && item.isPortrait !== (orientation === 'portrait')) return false
        if (photo === 'with' && item.hasPhoto !== true) return false
        return true
      })
  }, [orientation, photo, price, results])

  if (!snapshot) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-16 text-center text-sm">
        No snapshot was stored for this side.
      </div>
    )
  }

  if (snapshot.results.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-16 text-center text-sm">
        No results were captured for this query.
      </div>
    )
  }

  const reset = () => {
    setPrice('all')
    setOrientation('all')
    setPhoto('all')
  }
  const activeFilters = (price !== 'all' ? 1 : 0) + (orientation !== 'all' ? 1 : 0) + (photo === 'with' ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      {!canFilter && (
        <p className="text-muted-foreground text-xs">
          Re-capture this query to enable result filters (Free/PRO, orientation, photo).
        </p>
      )}
      {canFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <FilterChip active={activeFilters === 0} onClick={reset}>
              All
            </FilterChip>
            {hasPrice && (
              <>
                <FilterChip active={price === 'free'} onClick={() => setPrice(price === 'free' ? 'all' : 'free')}>
                  Free
                </FilterChip>
                <FilterChip active={price === 'premium'} onClick={() => setPrice(price === 'premium' ? 'all' : 'premium')}>
                  PRO
                </FilterChip>
              </>
            )}
            {hasOrientation && (
              <>
                <FilterChip
                  active={orientation === 'portrait'}
                  onClick={() => setOrientation(orientation === 'portrait' ? 'all' : 'portrait')}
                >
                  Portrait
                </FilterChip>
                <FilterChip
                  active={orientation === 'landscape'}
                  onClick={() => setOrientation(orientation === 'landscape' ? 'all' : 'landscape')}
                >
                  Landscape
                </FilterChip>
              </>
            )}
            {hasPhoto && (
              <FilterChip active={photo === 'with'} onClick={() => setPhoto(photo === 'with' ? 'all' : 'with')}>
                With photo
              </FilterChip>
            )}
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {filtered.length} of {snapshot.results.length}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
          No results match these filters.{' '}
          <button type="button" onClick={reset} className="text-primary underline-offset-4 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map(({ item, index }) => {
            return (
              <li key={`${item.id}-${index}`} className="min-w-0">
                <article className="bg-card overflow-hidden rounded-xl border">
                  <div className="bg-muted relative" style={{ aspectRatio: ratio(item) }}>
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                        No preview
                      </div>
                    )}
                    <span className="bg-background/90 absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums shadow-sm">
                      #{index + 1}
                    </span>
                    {typeof item.isFree === 'boolean' && (
                      <Badge
                        variant={item.isFree ? 'secondary' : 'default'}
                        className="absolute top-2 right-2 shadow-sm"
                      >
                        {item.isFree ? 'Free' : 'PRO'}
                      </Badge>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="line-clamp-2 text-sm leading-snug font-medium">{item.name}</p>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
