import { NextResponse } from 'next/server'
import { User } from '@supabase/supabase-js'

import {
  assertSchoolMatch,
  getCurrentSchoolId,
} from '@namaa-loc/db/auth.server'
import { createSupabaseServerClient } from '@namaa-loc/db/server'

const ADMIN_ROLES = ['super_admin', 'school_admin', 'dean', 'teacher', 'support_staff', 'house_mentor'] as const
const SUPER_ADMIN_ROLES = ['super_admin'] as const

export type AllowedRole = (typeof ADMIN_ROLES)[number] | (typeof SUPER_ADMIN_ROLES)[number] | 'parent' | 'student'

type AuthFailure = {
  error: NextResponse
  supabase?: undefined
  user?: undefined
}

type AuthSuccess = {
  error: null
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  user: User
}

type RoleSuccess = AuthSuccess & { role: AllowedRole }

export async function requireAuthenticatedUser(): Promise<AuthFailure | AuthSuccess> {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  return { error: null, supabase, user: authData.user }
}

export async function requireRole(roles: readonly AllowedRole[]): Promise<AuthFailure | RoleSuccess> {
  const auth = await requireAuthenticatedUser()
  if (auth.error || !auth.supabase || !auth.user) {
    return auth
  }

  const currentSchoolId = await getCurrentSchoolId()
  if (!currentSchoolId) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { data: profile, error: roleError } = await auth.supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', auth.user.id)
    .eq('school_id', currentSchoolId)
    .maybeSingle()

  if (roleError || !profile || !assertSchoolMatch(profile.school_id, currentSchoolId)) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const role = profile.role ?? null
  if (!role || !roles.includes(role as AllowedRole)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { error: null, supabase: auth.supabase, user: auth.user, role: role as AllowedRole }
}

export const RoleSets = {
  admin: ADMIN_ROLES,
  superAdmin: SUPER_ADMIN_ROLES,
}
