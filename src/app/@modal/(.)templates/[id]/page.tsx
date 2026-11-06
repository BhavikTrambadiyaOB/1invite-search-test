import { Suspense } from 'react'
import { DetailsModal } from '@/components/search/details-modal'
import { TemplateDetailsView } from '@/components/search/template-details-view'
import { Skeleton } from '@/components/ui/skeleton'

/** Template details opened from search results: shown as a modal over the results. */
export default function TemplateDetailsModal({ params, searchParams }: PageProps<'/templates/[id]'>) {
  return (
    <DetailsModal>
      <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
        <Details params={params} searchParams={searchParams} />
      </Suspense>
    </DetailsModal>
  )
}

async function Details({ params, searchParams }: PageProps<'/templates/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <TemplateDetailsView id={id} debug={query.debug === 'true'} />
}
