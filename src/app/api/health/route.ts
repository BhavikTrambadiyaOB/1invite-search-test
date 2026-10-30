import { NextResponse } from 'next/server'
import { checkDatabaseConnection } from '@/lib/db'

export async function GET() {
  try {
    await checkDatabaseConnection()
    return NextResponse.json({ status: 'ok', database: 'ok' })
  } catch (error) {
    console.error('Database health check failed:', error)
    return NextResponse.json(
      { status: 'error', database: 'unreachable' },
      { status: 503 },
    )
  }
}
