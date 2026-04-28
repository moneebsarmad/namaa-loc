'use client'

import { ReactNode } from 'react'
import { usePermission, useUserProfile, useUserRole } from '../hooks/usePermissions'
import { Permission, Role, ROLES } from '../lib/permissions'
import type { DbRole } from '../lib/portalRoles'

interface RequirePermissionProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

// Component that only renders children if user has the specified permission
export function RequirePermission({
  permission,
  children,
  fallback = null,
  loadingComponent = null,
}: RequirePermissionProps) {
  const { hasPermission, loading } = usePermission(permission)

  if (loading) {
    return loadingComponent ? <>{loadingComponent}</> : null
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>
}

interface RequireRoleProps {
  roles: Role | Role[]
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

// Component that only renders children if user has one of the specified roles
export function RequireRole({
  roles,
  children,
  fallback = null,
  loadingComponent = null,
}: RequireRoleProps) {
  const { role, loading } = useUserRole()

  if (loading) {
    return loadingComponent ? <>{loadingComponent}</> : null
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  const hasRole = role && allowedRoles.includes(role)

  return hasRole ? <>{children}</> : <>{fallback}</>
}

interface RequireDbRoleProps {
  dbRoles: DbRole | DbRole[]
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

export function RequireDbRole({
  dbRoles,
  children,
  fallback = null,
  loadingComponent = null,
}: RequireDbRoleProps) {
  const { profile, loading } = useUserProfile()

  if (loading) {
    return loadingComponent ? <>{loadingComponent}</> : null
  }

  const allowedDbRoles = Array.isArray(dbRoles) ? dbRoles : [dbRoles]
  const hasDbRole = profile?.role ? allowedDbRoles.includes(profile.role) : false

  return hasDbRole ? <>{children}</> : <>{fallback}</>
}

interface RequireStaffProps {
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

// Shorthand component for staff-only content (teacher, house mentor, or support staff)
export function RequireStaff({ children, fallback = null, loadingComponent = null }: RequireStaffProps) {
  return (
    <RequireRole
      roles={[ROLES.ADMIN, ROLES.STAFF]}
      fallback={fallback}
      loadingComponent={loadingComponent}
    >
      {children}
    </RequireRole>
  )
}

interface PermissionGateProps {
  permission?: Permission
  roles?: Role | Role[]
  dbRoles?: DbRole | DbRole[]
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

// Flexible gate that can check either permission or role
export function PermissionGate({
  permission,
  roles,
  dbRoles,
  children,
  fallback = null,
  loadingComponent = null,
}: PermissionGateProps) {
  if (permission) {
    return (
      <RequirePermission
        permission={permission}
        fallback={fallback}
        loadingComponent={loadingComponent}
      >
        {children}
      </RequirePermission>
    )
  }

  if (roles) {
    return (
      <RequireRole roles={roles} fallback={fallback} loadingComponent={loadingComponent}>
        {children}
      </RequireRole>
    )
  }

  if (dbRoles) {
    return (
      <RequireDbRole dbRoles={dbRoles} fallback={fallback} loadingComponent={loadingComponent}>
        {children}
      </RequireDbRole>
    )
  }

  // If neither specified, render children
  return <>{children}</>
}

interface RequireSuperAdminProps {
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

export function RequireSuperAdmin({
  children,
  fallback = null,
  loadingComponent = null,
}: RequireSuperAdminProps) {
  return (
    <RequireDbRole
      dbRoles="super_admin"
      fallback={fallback}
      loadingComponent={loadingComponent}
    >
      {children}
    </RequireDbRole>
  )
}

// Access denied component for use as fallback
export function AccessDenied({ message = 'You do not have permission to view this content.' }) {
  return (
    <div className="bg-[#910000]/5 border border-[#910000]/20 rounded-xl p-6 text-center">
      <svg
        className="w-12 h-12 mx-auto text-[#910000]/60 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <h3 className="text-lg font-semibold text-[#910000] mb-2">Access Denied</h3>
      <p className="text-sm text-[#1a1a1a]/60">{message}</p>
    </div>
  )
}
