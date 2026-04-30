'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { type DbRole as LegacyDbRole } from './portalRoles'

export const PERMISSIONS = {
  POINTS_AWARD: 'points.award',
  POINTS_DEDUCT: 'points.deduct',
  POINTS_VIEW_ALL: 'points.view_all',
  ANALYTICS_VIEW_ALL: 'analytics.view_all',
  ANALYTICS_VIEW_HOUSE: 'analytics.view_house',
  STUDENTS_VIEW_ALL: 'students.view_all',
  STUDENTS_VIEW_HOUSE: 'students.view_house',
  REPORTS_EXPORT_ALL: 'reports.export_all',
  REPORTS_EXPORT_HOUSE: 'reports.export_house',
  STAFF_MANAGE: 'staff.manage',
  SYSTEM_CONFIGURE: 'system.configure',
  AUDIT_VIEW: 'audit.view',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  PARENT: 'parent',
  STUDENT: 'student',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

type CleanDbRole =
  | 'super_admin'
  | 'school_admin'
  | 'dean'
  | 'teacher'
  | 'support_staff'
  | 'house_mentor'
  | 'parent'
  | 'student'

export type DbRole = LegacyDbRole | CleanDbRole

type AuthClaims = {
  userId: string | null
  schoolId: string | null
  role: DbRole | null
}

type CachedProfile = {
  profile: UserProfile | null
  fetchedAtMs: number
}

const PROFILE_CACHE_TTL_MS = 30_000
const VALID_DB_ROLES = new Set<DbRole>([
  'super_admin',
  'school_admin',
  'dean',
  'teacher',
  'support_staff',
  'house_mentor',
  'parent',
  'student',
  'admin',
  'staff',
])
const PROFILE_CACHE = new Map<string, CachedProfile>()

export interface UserProfile {
  id: string
  school_id: string
  role: DbRole | null
  linked_student_id?: string | null
  linked_staff_id?: string | null
  assigned_house?: string | null
}

function normalizeString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeDbRole(value: unknown): DbRole | null {
  if (typeof value !== 'string') {
    return null
  }

  return VALID_DB_ROLES.has(value as DbRole) ? (value as DbRole) : null
}

async function getAuthClaims(supabase: SupabaseClient): Promise<AuthClaims> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user ?? null

  return {
    userId: user?.id ?? null,
    schoolId: normalizeString(user?.app_metadata?.school_id as string | null),
    role: normalizeDbRole(user?.app_metadata?.role),
  }
}

function mapDbRoleToAppRole(dbRole: DbRole | null): Role | null {
  switch (dbRole) {
    case 'parent':
      return ROLES.PARENT
    case 'student':
      return ROLES.STUDENT
    case 'super_admin':
    case 'school_admin':
    case 'dean':
    case 'teacher':
    case 'support_staff':
    case 'house_mentor':
    case 'admin':
    case 'staff':
      return ROLES.STAFF
    default:
      return null
  }
}

function dbRoleHasPermission(role: DbRole | null, permission: Permission): boolean {
  if (!role) {
    return false
  }

  if (role === 'super_admin' || role === 'school_admin') {
    return true
  }

  const deanPermissions = new Set<Permission>([
    PERMISSIONS.POINTS_AWARD,
    PERMISSIONS.POINTS_DEDUCT,
    PERMISSIONS.POINTS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_VIEW_HOUSE,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_HOUSE,
    PERMISSIONS.REPORTS_EXPORT_ALL,
    PERMISSIONS.REPORTS_EXPORT_HOUSE,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SYSTEM_CONFIGURE,
  ])

  const teacherPermissions = new Set<Permission>([
    PERMISSIONS.POINTS_AWARD,
    PERMISSIONS.POINTS_DEDUCT,
    PERMISSIONS.POINTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_HOUSE,
    PERMISSIONS.REPORTS_EXPORT_HOUSE,
  ])

  const supportStaffPermissions = new Set<Permission>([
    PERMISSIONS.POINTS_AWARD,
    PERMISSIONS.POINTS_DEDUCT,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_HOUSE,
  ])

  const houseMentorPermissions = new Set<Permission>([
    PERMISSIONS.POINTS_AWARD,
    PERMISSIONS.POINTS_DEDUCT,
    PERMISSIONS.POINTS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_VIEW_HOUSE,
    PERMISSIONS.STUDENTS_VIEW_HOUSE,
    PERMISSIONS.REPORTS_EXPORT_HOUSE,
  ])

  switch (role) {
    case 'dean':
      return deanPermissions.has(permission)
    case 'teacher':
      return teacherPermissions.has(permission)
    case 'support_staff':
      return supportStaffPermissions.has(permission)
    case 'house_mentor':
      return houseMentorPermissions.has(permission)
    case 'admin':
    case 'staff':
      return teacherPermissions.has(permission)
    case 'parent':
    case 'student':
    default:
      return false
  }
}

function getCachedProfile(cacheKey: string): UserProfile | null {
  const cached = PROFILE_CACHE.get(cacheKey)

  if (!cached) {
    return null
  }

  if (Date.now() - cached.fetchedAtMs > PROFILE_CACHE_TTL_MS) {
    PROFILE_CACHE.delete(cacheKey)
    return null
  }

  return cached.profile
}

function setCachedProfile(cacheKey: string, profile: UserProfile | null) {
  PROFILE_CACHE.set(cacheKey, {
    profile,
    fetchedAtMs: Date.now(),
  })
}

async function fetchProfileForCurrentSchool(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { userId, schoolId } = await getAuthClaims(supabase)
  if (!userId || !schoolId) {
    return null
  }

  const cacheKey = `${schoolId}:${userId}`
  const cached = getCachedProfile(cacheKey)
  if (cached) {
    return cached
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  const profile = data ? (data as UserProfile) : null
  setCachedProfile(cacheKey, profile)

  return profile
}

export async function hasPermission(
  supabase: SupabaseClient,
  permission: Permission
): Promise<boolean> {
  try {
    const { role } = await getAuthClaims(supabase)
    return dbRoleHasPermission(role, permission)
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

export async function getUserRole(supabase: SupabaseClient): Promise<Role | null> {
  try {
    const { role } = await getAuthClaims(supabase)
    return mapDbRoleToAppRole(role)
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

export async function getUserDbRole(supabase: SupabaseClient): Promise<DbRole | null> {
  try {
    const { role } = await getAuthClaims(supabase)
    return role
  } catch (error) {
    console.error('Error getting user db role:', error)
    return null
  }
}

export async function getUserHouse(supabase: SupabaseClient): Promise<string | null> {
  try {
    const profile = await fetchProfileForCurrentSchool(supabase)
    return profile?.assigned_house ?? null
  } catch (error) {
    console.error('Error getting user house:', error)
    return null
  }
}

export async function getUserPermissions(
  supabase: SupabaseClient
): Promise<{ permission_name: string; description: string; category: string }[]> {
  try {
    const { role } = await getAuthClaims(supabase)
    const permissions = Object.values(PERMISSIONS).filter((perm) => dbRoleHasPermission(role, perm))

    return permissions.map((permission_name) => ({
      permission_name,
      description: '',
      category: permission_name.split('.')[0] || '',
    }))
  } catch (error) {
    console.error('Error getting user permissions:', error)
    return []
  }
}

export async function getUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  try {
    return await fetchProfileForCurrentSchool(supabase)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

export function isElevatedRole(role: Role | null): boolean {
  if (!role) return false
  return role === ROLES.ADMIN
}

export function isSuperAdmin(role: Role | null): boolean {
  return role === ROLES.ADMIN
}

export function canViewAllData(role: Role | null): boolean {
  if (!role) return false
  return role === ROLES.ADMIN
}

export function isHouseRestricted(role: Role | null): boolean {
  void role
  return false
}
