import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PageItem = number | 'ellipsis'

/** Windowed page numbers: first, last, and the pages around the current one. */
function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p))

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  for (const p of sorted) {
    if (items.length > 0 && p - (items[items.length - 1] as number) > 1) items.push('ellipsis')
    items.push(p)
  }
  return items
}

/**
 * Shared pagination: icon buttons on phones, numbered pages from `sm` up.
 * `hrefForPage` keeps each page's existing query string and filters.
 */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  label = 'Pages',
  className,
}: {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
  label?: string
  className?: string
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1', className)}>
      {page > 1 ? (
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href={hrefForPage(page - 1)} aria-label="Previous page">
            <ChevronLeftIcon />
            <span className="hidden sm:inline">Previous</span>
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="gap-1" disabled aria-label="Previous page">
          <ChevronLeftIcon />
          <span className="hidden sm:inline">Previous</span>
        </Button>
      )}

      <span className="text-muted-foreground px-1 text-xs tabular-nums sm:hidden">
        Page {page} of {totalPages}
      </span>

      <div className="hidden items-center gap-1 sm:flex">
        {pageItems(page, totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="text-muted-foreground px-1 text-xs">
              …
            </span>
          ) : (
            <Button
              key={item}
              asChild
              variant={item === page ? 'default' : 'ghost'}
              size="icon"
              className="size-8 text-xs"
            >
              <Link
                href={hrefForPage(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Link>
            </Button>
          ),
        )}
      </div>

      {page < totalPages ? (
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href={hrefForPage(page + 1)} aria-label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="gap-1" disabled aria-label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon />
        </Button>
      )}
    </nav>
  )
}
