import { NextResponse } from 'next/server'
import { withSchoolScope } from '@namaa-loc/db/auth.server'
import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

import { primeStandingsHealthCache } from '@/lib/standingsHealth'
import { normalizeHouseStandingsRows } from '@/lib/leaderboardViewRows'

type CronAuthOptions = {
  allowInDev?: boolean
}

const HEARTBEAT_TIMEOUT_MS = 5_000

function isDevelopment() {
  return process.env.NODE_ENV !== 'production'
}

function requireCronSecret(request: Request, options: CronAuthOptions = {}) {
  const { allowInDev = true } = options
  const secret = process.env.CRON_SECRET

  if (!secret) {
    if (allowInDev && isDevelopment()) {
      return null
    }

    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 500 }
    )
  }

  const bearer = request.headers.get('authorization')
  const direct = request.headers.get('x-cron-secret')
  if (bearer === `Bearer ${secret}` || direct === secret) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function heartbeatEnvKey(cronName: string): string {
  const normalised = cronName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `HEARTBEAT_URL_${normalised}`
}

async function pingHeartbeat(cronName: string): Promise<void> {
  const url = process.env[heartbeatEnvKey(cronName)]
  if (!url) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS)

  try {
    await fetch(url, { method: 'GET', signal: controller.signal })
  } catch (error) {
    console.warn(`[heartbeat] ping failed for "${cronName}":`, (error as Error).message)
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  const authError = requireCronSecret(request)
  if (authError) {
    return authError
  }

  try {
    return await withSchoolScope(async (schoolId) => {
      const supabaseAdmin = createSupabaseServiceRoleClient()

      const { data: standings, error: standingsError } = await supabaseAdmin
        .from('house_standings_view')
        .select('*')
        .eq('school_id', schoolId)

      if (standingsError) {
        return NextResponse.json({ error: standingsError.message }, { status: 500 })
      }

      const computedAt = new Date().toISOString()
      const payload = normalizeHouseStandingsRows((standings || []) as Record<string, unknown>[])
        .map((row) => ({
          school_id: schoolId,
          house: row.house,
          total_points: row.totalPoints,
          computed_at: computedAt,
        }))

      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from('house_standings_cache')
        .upsert(payload, { onConflict: 'school_id,house' })
        .select('school_id, house, total_points, computed_at')

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }

      primeStandingsHealthCache(computedAt)
      await pingHeartbeat('recompute-house-standings')

      return NextResponse.json({
        ok: true,
        computed_at: computedAt,
        row_count: upserted?.length ?? 0,
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Missing school context.') {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 401 })
    }

    console.error('Error recomputing house standings cache (cron):', error)
    return NextResponse.json({ error: 'Failed to recompute house standings.' }, { status: 500 })
  }
}
