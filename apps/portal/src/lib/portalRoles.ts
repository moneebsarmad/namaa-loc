export type PortalRole = 'student' | 'parent' | 'staff'
export type DbRole =
  | 'student'
  | 'parent'
  | 'staff'
  | 'teacher'
  | 'support_staff'
  | 'house_mentor'
  | 'admin'
  | 'super_admin'

const STAFF_PORTAL_DB_ROLES = new Set<DbRole>([
  'staff',
  'teacher',
  'support_staff',
  'house_mentor',
  'admin',
  'super_admin',
])

const ADMIN_DB_ROLES = new Set<DbRole>(['admin', 'super_admin'])
const SUPER_ADMIN_DB_ROLES = new Set<DbRole>(['super_admin'])
const STUDENT_DIRECTORY_DB_ROLES = new Set<DbRole>(['admin', 'super_admin', 'house_mentor'])
const STUDENT_LOOKUP_DB_ROLES = new Set<DbRole>([
  'staff',
  'teacher',
  'support_staff',
  'house_mentor',
  'admin',
  'super_admin',
])

export function mapDbRoleToPortalRole(dbRole: string | null): PortalRole | null {
  if (!dbRole) return null
  if (dbRole === 'student') return 'student'
  if (dbRole === 'parent') return 'parent'
  if (STAFF_PORTAL_DB_ROLES.has(dbRole as DbRole)) return 'staff'
  return null
}

export function hasAdminPortalAccess(dbRole: string | null): boolean {
  if (!dbRole) return false
  return ADMIN_DB_ROLES.has(dbRole as DbRole)
}

export function isSuperAdminRole(dbRole: string | null): boolean {
  if (!dbRole) return false
  return SUPER_ADMIN_DB_ROLES.has(dbRole as DbRole)
}

export function canBrowseStudentDirectory(dbRole: string | null): boolean {
  if (!dbRole) return false
  return STUDENT_DIRECTORY_DB_ROLES.has(dbRole as DbRole)
}

export function canUseStudentLookup(dbRole: string | null): boolean {
  if (!dbRole) return false
  return STUDENT_LOOKUP_DB_ROLES.has(dbRole as DbRole)
}

export function isHouseMentorRole(dbRole: string | null): boolean {
  return dbRole === 'house_mentor'
}
