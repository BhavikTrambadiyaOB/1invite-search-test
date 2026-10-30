import { mastra } from '@/mastra'

const BATCH = 50
/** Templates tagged at the same time when the run does not say (--parallel). */
export const DEFAULT_PARALLEL = 5

type WorkflowOutput = {
  saved: number
  failed: { templateId: number; error: string }[]
  enriched: {
    templateId: number
    occasion: string | null
    occasionConfidence: number
    gender: string | null
    milestone: number | null
    format: string | null
    docType: string | null
    themes: string[]
    assets: string[]
    styles: string[]
    colors: string[]
    moods: string[]
    colorShades: string[]
    extraOccasions: string[]
    languages: string[]
    hasPhoto: boolean
    qualityScore: number
    summary: string
    newTerms: string[]
  }[]
}

/** Runs the AI enrichment workflow on templates in batches. With save=false nothing is written to templates. */
export async function runAiEnrichment(
  ids: number[],
  {
    save,
    parallel,
    onBatch,
  }: { save: boolean; parallel?: number; onBatch?: (done: number, total: number, output: WorkflowOutput) => void },
): Promise<WorkflowOutput> {
  // The app's own Mastra instance: same storage and tracing, so every AI call here is traced too.
  const workflow = mastra.getWorkflow('templateEnrichmentWorkflow')
  const total: WorkflowOutput = { saved: 0, failed: [], enriched: [] }

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const run = await workflow.createRun()
    const result = await run.start({ inputData: { templateIds: batch, save, parallel: parallel ?? DEFAULT_PARALLEL } })
    if (result.status !== 'success') {
      const error = result.status === 'failed' ? String(result.error) : result.status
      total.failed.push(...batch.map((templateId) => ({ templateId, error })))
      continue
    }
    const out = result.result as WorkflowOutput
    total.saved += out.saved
    total.failed.push(...out.failed)
    total.enriched.push(...out.enriched)
    onBatch?.(Math.min(i + BATCH, ids.length), ids.length, out)
  }
  return total
}
