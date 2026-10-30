import { Suspense } from 'react'
import { DetailsModal } from '@/components/search/details-modal'
import { TemplateDetailsView } from '@/components/search/template-details-view'
import { Skeleton } from '@/components/ui/skeleton'

/** Template details opened from search results: shown as a modal over the results. */
export default function TemplateDetailsModal({ params }: PageProps<'/templates/[id]'>) {
  return (
    <DetailsModal>
      <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
        <Details params={params} />
      </Suspense>
    </DetailsModal>
  )
}

async function Details({ params }: { params: PageProps<'/templates/[id]'>['params'] }) {
  const { id } = await params
  return <TemplateDetailsView id={id} />
}
