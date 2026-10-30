import { db } from '@/lib/db'

/**
 * Ends a script that may have made AI calls: flushes pending traces first (they are written
 * through the database pool), then closes the pool. Without this, the last traces can be lost.
 * `beforeClose` runs after the flush, so it can read this run's traces (e.g. a cost report).
 */
export async function flushTracesAndClose(beforeClose?: () => Promise<void>) {
  try {
    const { mastra, observability } = await import('@/mastra')
    // Finish storage setup first: flushing starts it lazily, and it must not outlive the pool.
    await mastra.getStorage()?.init()
    await observability.shutdown()
  } catch (error) {
    console.error('Could not flush traces', error)
  }
  if (beforeClose) await beforeClose().catch((error) => console.error('Report failed', error))
  await db.end()
}
