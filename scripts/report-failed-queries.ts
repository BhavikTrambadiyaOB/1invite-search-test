/**
 * Builds the daily failed-query report. Run once a day (e.g. from cron) after midnight UTC.
 * Usage: npm run search:report                 (yesterday)
 *        npm run search:report -- 2026-10-27   (a given day, UTC)
 */
import { db } from '@/lib/db'
import { saveDailyReport } from '@/lib/search/failed-queries'

async function main() {
  const arg = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const day = arg ? new Date(`${arg}T00:00:00Z`) : new Date(Date.now() - 86_400_000)
  const result = await saveDailyReport(day)
  console.log(`failed-query report for ${result.day}: ${result.queries} queries`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
