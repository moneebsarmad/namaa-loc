import { NextResponse } from 'next/server'
import { withSchoolScope } from '@namaa-loc/db/auth.server'
import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

import { requireRole, RoleSets } from '@/lib/apiAuth'
import { primeStandingsHealthCache } from '@/lib/standingsHealth'
import { normalizeHouseStandingsRows } from '@/lib/leaderboardViewRows'
import { writeAuditLog } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    return await withSchoolScope(async (schoolId) => {
      const auth = await requireRole(RoleSets.admin)
      if (auth.error) {
        return auth.error
      }

      const supabaseAdmin = createSupabaseServiceRoleClient()
      const computedAt = new Date().toISOString()

      const { data: standings, error: standingsError } = await supabaseAdmin
        .from('house_standings_view')
        .select('*')
        .eq('school_id', schoolId)

      if (standingsError) {
        return NextResponse.json({ error: standingsError.message }, { status: 500 })
      }

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

      await writeAuditLog({
        schoolId,
        actor: { id: auth.user.id, email: auth.user.email ?? null, role: auth.role ?? null },
        action: 'admin.recompute_house_standings',
        targetType: 'house_standings_cache',
        metadata: {
          houses_updated: (upserted ?? []).length,
          computed_at: computedAt,
        },
        request,
      })

      return NextResponse.json({ data: upserted ?? [] })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Missing school context.') {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 401 })
    }

    console.error('Error recomputing house standings cache:', error)
    return NextResponse.json({ error: 'Failed to recompute house standings.' }, { status: 500 })
  }
}
