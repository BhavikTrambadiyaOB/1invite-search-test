import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google'
import { Explainer } from '@/components/search/how-it-works/explainer'
import { ExplainerShell } from '@/components/search/how-it-works/explainer-shell'

// Page-only fonts: a display face for headings, a highly readable body face, and a mono face for numbers.
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--hiw-display' })
const body = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--hiw-body' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--hiw-mono' })

export const metadata: Metadata = {
  title: 'How Search Works',
  description: 'How templates are labelled, how a search is read, how results are ordered and how tags are suggested.',
}

export default function HowItWorksPage() {
  return (
    <ExplainerShell className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <Explainer />
    </ExplainerShell>
  )
}
