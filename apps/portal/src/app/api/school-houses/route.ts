import { NextResponse } from 'next/server'

import { getCurrentSchoolId } from '@namaa-loc/db/auth.server'
import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

import type { SchoolHouseRecord } from '@/lib/schoolHouses'

export async function GET() {
  const schoolId = await getCurrentSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from('houses')
    .select('name, display_name, value, color, icon_url, sort_order, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ houses: (data || []) as SchoolHouseRecord[] })
}
