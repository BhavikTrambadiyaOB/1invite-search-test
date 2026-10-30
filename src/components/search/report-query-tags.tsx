import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { querySearchHref, queryTagFilterHref, type QueryTag } from '@/lib/search/query-tags'

export function ReportQueryTags({ query, tags }: { query: string; tags: QueryTag[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Query tags and search filters">
      <span className="text-muted-foreground text-[10px]">Tags · filter:</span>
      {tags.length === 0 && <span className="text-muted-foreground text-[10px]">None detected</span>}
      {tags.map((tag) => (
        <Link
          key={tag.key}
          href={queryTagFilterHref(query, tag)}
          title={tag.group === 'format' ? `Search query with ${tag.label}` : `Filter search by ${tag.label}`}
          aria-label={
            tag.group === 'format'
              ? `Search query ${query} with ${tag.label}`
              : `Filter search for ${query} by ${tag.label}`
          }
          className="rounded-full focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-normal">
            {tag.label}
          </Badge>
        </Link>
      ))}
      <Link
        href={querySearchHref(query)}
        className="text-primary text-[10px] underline-offset-2 hover:underline"
      >
        Open filters
      </Link>
    </div>
  )
}
