import { NextResponse } from 'next/server'

import {
  assertSchoolMatch,
  getCurrentSchoolId,
} from '@namaa-loc/db/auth.server'
import { createSupabaseServerClient } from '@namaa-loc/db/server'

const ADMIN_ROLES = ['super_admin', 'school_admin'] as const

export interface AdminCheckResult {
  isAdmin: boolean
  userId: string | null
  userEmail: string | null
  error?: NextResponse
}

/**
 * Check if the current user has admin access
 * Returns user info if admin, or an error response if not
 */
export async function checkAdminAccess(): Promise<AdminCheckResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        isAdmin: false,
        userId: null,
        userEmail: null,
        error: NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        ),
      }
    }

    const currentSchoolId = await getCurrentSchoolId()
    if (!currentSchoolId) {
      return {
        isAdmin: false,
        userId: user.id,
        userEmail: user.email ?? null,
        error: NextResponse.json(
          { success: false, error: 'School context missing' },
          { status: 403 }
        ),
      }
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .eq('school_id', currentSchoolId)
      .maybeSingle()

    if (error || !profile || !assertSchoolMatch(profile.school_id, currentSchoolId)) {
      return {
        isAdmin: false,
        userId: user.id,
        userEmail: user.email ?? null,
        error: NextResponse.json(
          { success: false, error: 'Profile not found' },
          { status: 403 }
        ),
      }
    }

    const hasAdminAccess = ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])

    if (!hasAdminAccess) {
      return {
        isAdmin: false,
        userId: user.id,
        userEmail: user.email ?? null,
        error: NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        ),
      }
    }

    return {
      isAdmin: true,
      userId: user.id,
      userEmail: user.email ?? null,
    }
  } catch (err) {
    console.error('Error checking admin access:', err)
    return {
      isAdmin: false,
      userId: null,
      userEmail: null,
      error: NextResponse.json(
        { success: false, error: 'Authentication error' },
        { status: 500 }
      ),
    }
  }
}
