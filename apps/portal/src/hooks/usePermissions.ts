'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  hasPermission,
  getUserRole,
  getUserDbRole,
  getUserHouse,
  getUserPermissions,
  getUserProfile,
  Permission,
  Role,
  UserProfile,
} from '../lib/permissions'

// Hook to check a single permission
export function usePermission(permission: Permission) {
  const [result, setResult] = useState<{ hasPermission: boolean; loading: boolean }>({
    hasPermission: false,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function checkPerm() {
      const hasPerm = await hasPermission(supabase, permission)
      if (mounted) {
        setResult({ hasPermission: hasPerm, loading: false })
      }
    }

    checkPerm()

    return () => {
      mounted = false
    }
  }, [permission])

  return result
}

// Hook to check multiple permissions at once
export function usePermissions(permissions: Permission[]) {
  const [result, setResult] = useState<{
    permissions: Record<Permission, boolean>
    loading: boolean
  }>({
    permissions: {} as Record<Permission, boolean>,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function checkPerms() {
      const results: Record<Permission, boolean> = {} as Record<Permission, boolean>

      await Promise.all(
        permissions.map(async (perm) => {
          results[perm] = await hasPermission(supabase, perm)
        })
      )

      if (mounted) {
        setResult({ permissions: results, loading: false })
      }
    }

    checkPerms()

    return () => {
      mounted = false
    }
  }, [permissions.join(',')])

  return result
}

// Hook to get user's role
export function useUserRole() {
  const [result, setResult] = useState<{ role: Role | null; loading: boolean }>({
    role: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function fetchRole() {
      const role = await getUserRole(supabase)
      if (mounted) {
        setResult({ role, loading: false })
      }
    }

    fetchRole()

    return () => {
      mounted = false
    }
  }, [])

  return result
}

// Hook to get user's assigned house
export function useUserHouse() {
  const [result, setResult] = useState<{ house: string | null; loading: boolean }>({
    house: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function fetchHouse() {
      const house = await getUserHouse(supabase)
      if (mounted) {
        setResult({ house, loading: false })
      }
    }

    fetchHouse()

    return () => {
      mounted = false
    }
  }, [])

  return result
}

// Hook to get all user permissions
export function useAllPermissions() {
  const [result, setResult] = useState<{
    permissions: { permission_name: string; description: string; category: string }[]
    loading: boolean
  }>({
    permissions: [],
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function fetchPermissions() {
      const permissions = await getUserPermissions(supabase)
      if (mounted) {
        setResult({ permissions, loading: false })
      }
    }

    fetchPermissions()

    return () => {
      mounted = false
    }
  }, [])

  return result
}

// Hook to get full user profile with relations
export function useUserProfile() {
  const [result, setResult] = useState<{
    profile: UserProfile | null
    loading: boolean
    refetch: () => Promise<void>
  }>({
    profile: null,
    loading: true,
    refetch: async () => {},
  })

  const fetchProfile = useCallback(async () => {
    const profile = await getUserProfile(supabase)
    setResult((prev) => ({ ...prev, profile, loading: false }))
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      const profile = await getUserProfile(supabase)
      if (mounted) {
        setResult({ profile, loading: false, refetch: fetchProfile })
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [fetchProfile])

  return result
}

export function useUserDbRole() {
  const [result, setResult] = useState<{ dbRole: UserProfile['role'] | null; loading: boolean }>({
    dbRole: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    async function fetchDbRole() {
      const dbRole = await getUserDbRole(supabase)
      if (mounted) {
        setResult({ dbRole, loading: false })
      }
    }

    fetchDbRole()

    return () => {
      mounted = false
    }
  }, [])

  return result
}

// Combined hook for common permission patterns
export function useAuth() {
  const { role, loading: roleLoading } = useUserRole()
  const { profile, loading: profileLoading } = useUserProfile()
  const dbRole = profile?.role ?? null

  const loading = roleLoading || profileLoading

  return {
    role,
    profile,
    loading,
    isSuperAdmin: dbRole === 'super_admin',
    isAdmin: role === 'admin',
    isHouseMentor: dbRole === 'house_mentor',
    isTeacher: dbRole === 'teacher',
    isSupportStaff: dbRole === 'support_staff',
    isStaff: role === 'staff' || role === 'admin',
    isParent: role === 'parent',
    isStudent: role === 'student',
    assignedHouse: profile?.assigned_house ?? null,
  }
}
