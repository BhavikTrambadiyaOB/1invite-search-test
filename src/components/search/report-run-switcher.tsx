'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ReportSibling } from '@/lib/search/report'

/**
 * Version and phase dropdowns for one query. Each choice opens the same query's saved report
 * in that version and phase, so runs can be compared. Only runs that were captured are offered.
 */
export function ReportRunSwitcher({
  siblings,
  version,
  phase,
}: {
  siblings: ReportSibling[]
  version: number
  phase: number
}) {
  const router = useRouter()
  const versions = [...new Set(siblings.map((s) => s.version))].sort((a, b) => b - a)
  const phases = siblings.filter((s) => s.version === version).sort((a, b) => a.phase - b.phase)

  const open = (target: ReportSibling | undefined) => {
    if (target) router.push(`/search/report/${target.id}`)
  }

  const chooseVersion = (value: string) => {
    const next = Number(value)
    const inVersion = siblings.filter((s) => s.version === next)
    // Keep the same phase when that version has it, otherwise its first phase.
    open(inVersion.find((s) => s.phase === phase) ?? inVersion.sort((a, b) => a.phase - b.phase)[0])
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={String(version)} onValueChange={chooseVersion}>
        <SelectTrigger size="sm" className="h-7 gap-1 px-2 text-xs" aria-label="Version">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v} value={String(v)}>
              v{v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(phase)}
        onValueChange={(value) => open(phases.find((s) => s.phase === Number(value)))}
      >
        <SelectTrigger size="sm" className="h-7 gap-1 px-2 text-xs" aria-label="Phase">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {phases.map((s) => (
            <SelectItem key={s.id} value={String(s.phase)}>
              Phase {s.phase}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
