import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Consistent back affordance used at the top of every secondary page. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn('-ml-2 w-fit gap-1 text-muted-foreground', className)}>
      <Link href={href}>
        <ArrowLeftIcon />
        {children}
      </Link>
    </Button>
  )
}
