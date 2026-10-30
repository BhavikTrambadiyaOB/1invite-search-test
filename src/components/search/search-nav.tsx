import Link from 'next/link'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  phase?: string
}

const ITEMS: NavItem[] = [
  { href: '/search', label: 'Search' },
  { href: '/search/report', label: 'Search report', phase: '1' },
  { href: '/search/insights', label: 'Failed queries', phase: '2' },
]

/** Search, report and failed-query tabs. The report is phase 1 so it is checked before tuning search. */
export function SearchNav({ active }: { active: 'search' | 'report' | 'failed' }) {
  const activeHref = active === 'search' ? '/search' : active === 'report' ? '/search/report' : '/search/insights'

  return (
    <nav
      aria-label="Search tools"
      className="bg-muted/60 flex w-full flex-wrap items-center gap-1 rounded-2xl border p-1 sm:w-fit sm:flex-nowrap sm:rounded-full"
    >
      {ITEMS.map((item) => {
        const isActive = item.href === activeHref
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background hover:text-foreground',
            )}
          >
            {item.phase && (
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground',
                )}
              >
                {item.phase}
              </span>
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
