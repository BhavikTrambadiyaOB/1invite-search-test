import type { SearchResponse } from '@/lib/search/types'
import { searchHref, type SearchState } from '@/lib/search/url'
import { Pagination } from './pagination'

/** Total count and pagination, kept together under the results like the mobile app. */
export function ResultsFooter({ state, response }: { state: SearchState; response: SearchResponse }) {
  const totalPages = Math.max(1, Math.ceil(response.total / response.pageSize))

  return (
    <footer className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{response.total.toLocaleString()}</span>{' '}
        {response.total === 1 ? 'template' : 'templates'}
        {state.query ? (
          <>
            {' '}
            for <span className="font-medium">“{state.query}”</span>
          </>
        ) : (
          ', newest first'
        )}
      </p>

      {totalPages > 1 && (
        <Pagination
          page={response.page}
          totalPages={totalPages}
          hrefForPage={(page) => searchHref(state, { page })}
        />
      )}
    </footer>
  )
}
