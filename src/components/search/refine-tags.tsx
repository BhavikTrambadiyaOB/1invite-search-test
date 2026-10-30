import { XIcon } from 'lucide-react'
import Link from 'next/link'
import type { SearchResponse } from '@/lib/search/types'
import { tagHref, type SearchState } from '@/lib/search/url'

const chip =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors'

/**
 * One row of chips under the search box: the tags already chosen (tap × to remove), then suggested
 * tags that narrow the current results ("Kids Birthday", "1st", "Dinosaurs", "With photo").
 * Scrolls sideways on small screens, like a mobile app's filter row.
 */
export function RefineTags({ state, response }: { state: SearchState; response: SearchResponse }) {
  const { activeTags, suggestedTags } = response
  if (activeTags.length === 0 && suggestedTags.length === 0) return null

  return (
    <nav aria-label="Refine results" className="overflow-x-auto">
      <ul className="flex gap-2 pb-1 sm:flex-wrap">
        {activeTags.map((tag) => (
          <li key={`on-${tag.group}-${tag.value}`}>
            <Link
              href={tagHref(state, tag.group, tag.value, false)}
              scroll={false}
              aria-label={`Remove ${tag.label}`}
              className={`${chip} border-foreground/60 bg-background text-foreground hover:bg-muted`}
            >
              {tag.label}
              <XIcon className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
        {suggestedTags.map((tag) => (
          <li key={`add-${tag.group}-${tag.value}`}>
            <Link
              href={tagHref(state, tag.group, tag.value, true)}
              scroll={false}
              title={`${tag.count.toLocaleString()} templates`}
              className={`${chip} border-border text-foreground hover:bg-muted`}
            >
              {tag.label}
              <span className="text-muted-foreground text-xs tabular-nums">{tag.count.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
