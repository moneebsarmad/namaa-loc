'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { type DbRole } from './portalRoles'

// Permission constants
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

// Profile with relations
export interface UserProfile {
  id: string
  role: DbRole | null
  linked_student_id?: string | null
  linked_staff_id?: string | null
  assigned_house?: string | null
}

async function fetchProfileDbRole(supabase: SupabaseClient): Promise<DbRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error getting user role:', error)
    return null
  }

  return (data?.role ?? null) as DbRole | null
}

function mapDbRoleToAppRole(dbRole: DbRole | null): Role | null {
  switch (dbRole) {
    case 'super_admin':
    case 'admin':
      return ROLES.ADMIN
    case 'staff':
    case 'teacher':
    case 'support_staff':
    case 'house_mentor':
      return ROLES.STAFF
    case 'parent':
      return ROLES.PARENT
    case 'student':
      return ROLES.STUDENT
    default:
      return null
  }
}

function dbRoleHasPermission(role: DbRole | null, permission: Permission): boolean {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return true
    case 'house_mentor':
      return new Set<Permission>([
        PERMISSIONS.POINTS_AWARD,
        PERMISSIONS.POINTS_DEDUCT,
        PERMISSIONS.ANALYTICS_VIEW_HOUSE,
        PERMISSIONS.STUDENTS_VIEW_HOUSE,
        PERMISSIONS.REPORTS_EXPORT_HOUSE,
      ]).has(permission)
    case 'staff':
    case 'teacher':
    case 'support_staff':
      return new Set<Permission>([
        PERMISSIONS.POINTS_AWARD,
        PERMISSIONS.POINTS_DEDUCT,
      ]).has(permission)
    case 'parent':
    case 'student':
    default:
      return false
  }
}

// Check if user has a specific permission
export async function hasPermission(
  supabase: SupabaseClient,
  permission: Permission
): Promise<boolean> {
  try {
    const role = await fetchProfileDbRole(supabase)
    return dbRoleHasPermission(role, permission)
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

// Get user's role
export async function getUserRole(supabase: SupabaseClient): Promise<Role | null> {
  try {
    const dbRole = await fetchProfileDbRole(supabase)
    return mapDbRoleToAppRole(dbRole)
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

// Get user's assigned house (for house mentors)
export async function getUserHouse(supabase: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('assigned_house')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error getting user house:', error)
      return null
    }

    return data?.assigned_house ?? null
  } catch (error) {
    console.error('Error getting user house:', error)
    return null
  }
}

// Get all permissions for a user
export async function getUserPermissions(
  supabase: SupabaseClient
): Promise<{ permission_name: string; description: string; category: string }[]> {
  try {
    const role = await fetchProfileDbRole(supabase)
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

// Get full user profile
export async function getUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    return data as UserProfile
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

// Check if role has elevated access (admin or above)
export function isElevatedRole(role: Role | null): boolean {
  if (!role) return false
  return role === ROLES.ADMIN
}

// Check if role is super admin
export function isSuperAdmin(role: Role | null): boolean {
  return role === ROLES.ADMIN
}

// Check if role can view all data (not house-restricted)
export function canViewAllData(role: Role | null): boolean {
  if (!role) return false
  return role === ROLES.ADMIN
}

// Check if role is house-restricted
export function isHouseRestricted(role: Role | null): boolean {
  void role
  return false
}
