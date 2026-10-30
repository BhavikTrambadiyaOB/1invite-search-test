import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BackToSearch } from '@/components/search/back-to-search'
import { TemplateDetailsView } from '@/components/search/template-details-view'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Template Details',
  description: 'Everything known about one template.',
}

export default function TemplateDetailsPage({ params }: PageProps<'/templates/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      <BackToSearch />
      <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
        <Details params={params} />
      </Suspense>
    </main>
  )
}

async function Details({ params }: { params: PageProps<'/templates/[id]'>['params'] }) {
  const { id } = await params
  return <TemplateDetailsView id={id} />
}
