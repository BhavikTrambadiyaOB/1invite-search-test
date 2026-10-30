import { BarChart3Icon, ClipboardCheckIcon, SearchIcon } from 'lucide-react'
import Link from 'next/link'

const PAGES = [
  {
    href: '/search',
    title: 'Template Search',
    description: 'Find the right template with filters and quick tags.',
    icon: SearchIcon,
  },
  {
    href: '/search/report',
    title: 'Search Report',
    description: 'Compare live and current results side by side and save review feedback.',
    icon: ClipboardCheckIcon,
  },
  {
    href: '/search/insights',
    title: 'Failed Queries',
    description: 'Searches where users did not find a template: content gaps and search gaps.',
    icon: BarChart3Icon,
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">1invite Template Search</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {PAGES.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="hover:bg-accent focus-visible:ring-ring flex flex-col gap-3 rounded-xl border p-6 transition-colors outline-none focus-visible:ring-2"
          >
            <Icon className="text-muted-foreground size-6" />
            <span className="text-lg font-medium">{title}</span>
            <span className="text-muted-foreground text-sm">{description}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
