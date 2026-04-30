'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSchoolBranding } from '../../app/branding-context'

type NavItem = {
  id: string
  name: string
  href: string
  icon: string
  superAdminOnly?: boolean
}

// Items that should only be visible to super_admin
const SUPER_ADMIN_ONLY_ITEMS = ['announcements', 'data-quality', 'behaviour']

const navItems: NavItem[] = [
  { id: 'overview', name: 'Overview', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'rewards', name: 'Rewards', href: '/dashboard/rewards', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { id: 'analytics', name: 'Analytics', href: '/dashboard/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'students', name: 'Students', href: '/dashboard/students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'add-points', name: 'Add Points', href: '/dashboard/add-points', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { id: 'staff', name: 'Staff Engagement & Support', href: '/dashboard/staff', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'search', name: 'Search', href: '/dashboard/search', icon: 'M21 21l-4.35-4.35m1.6-4.15a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'announcements', name: 'Announcements', href: '/dashboard/announcements', icon: 'M7 8h10M7 12h10M7 16h6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'data-quality', name: 'Data Quality', href: '/dashboard/data-quality', icon: 'M9 12h6m2 9H7a2 2 0 01-2-2V5a2 2 0 012-2h6l4 4v12a2 2 0 01-2 2zM14 3v5h5' },
  { id: 'behaviour', name: 'Behaviour Insights', href: '/dashboard/behaviour', icon: 'M12 3l7 4v6c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V7l7-4zM9 12l2 2 4-4' },
  { id: 'reports', name: 'Reports', href: '/dashboard/reports', icon: 'M9 12h6m-6 4h6M7 8h10M5 20h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const defaultOrder = navItems.map((item) => item.id)
const defaultGroups: Record<string, 'Primary' | 'Admin'> = {
  overview: 'Primary',
  rewards: 'Primary',
  analytics: 'Primary',
  students: 'Primary',
  'add-points': 'Primary',
  staff: 'Admin',
  search: 'Admin',
  announcements: 'Admin',
  'data-quality': 'Admin',
  behaviour: 'Admin',
  reports: 'Admin',
  settings: 'Admin',
}

const groupOptions = ['Primary', 'Admin'] as const

export default function Sidebar() {
  const pathname = usePathname()
  const branding = useSchoolBranding()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [hidden, setHidden] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [compact, setCompact] = useState(false)
  const [groups, setGroups] = useState<Record<string, 'Primary' | 'Admin'>>(defaultGroups)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Load user role from profiles table
  useEffect(() => {
    const loadUserRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const role = sessionData.session?.user?.app_metadata?.role

      if (typeof role === 'string') {
        setUserRole(role)
      }
    }

    loadUserRole()
  }, [])

  useEffect(() => {
    const loadPreferences = async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data } = await supabase
        .from('nav_preferences')
        .select('collapsed_sections')
        .eq('user_id', authData.user.id)
        .maybeSingle()

      if (data?.collapsed_sections) {
        const stored = data.collapsed_sections as Record<string, unknown>
        const savedOrder = ((stored.order as string[]) || defaultOrder).filter((id) => defaultOrder.includes(id))
        const mergedOrder = [...savedOrder, ...defaultOrder.filter((id) => !savedOrder.includes(id))]
        const mergedGroups = { ...defaultGroups, ...((stored.groups as Record<string, 'Primary' | 'Admin'>) || {}) }
        setOrder(mergedOrder)
        setHidden((((stored.hidden as string[]) || []).filter((id) => defaultOrder.includes(id))))
        setFavorites((((stored.favorites as string[]) || []).filter((id) => defaultOrder.includes(id))))
        setCompact(Boolean(stored.compact))
        setGroups(mergedGroups)
      }
    }

    loadPreferences()
  }, [])

  // Filter out super admin only items if user is not super_admin
  const isSuperAdmin = userRole === 'super_admin'
  const visibleOrder = order.filter((id) => {
    if (hidden.includes(id)) return false
    if (SUPER_ADMIN_ONLY_ITEMS.includes(id) && !isSuperAdmin) return false
    return true
  })
  const itemsById = useMemo(() => new Map(navItems.map((item) => [item.id, item])), [])

  const groupedItems = useMemo(() => {
    const list = visibleOrder
      .map((id) => itemsById.get(id))
      .filter(Boolean) as NavItem[]
    const pinned = list.filter((item) => favorites.includes(item.id))
    const primary = list.filter((item) => !favorites.includes(item.id) && groups[item.id] === 'Primary')
    const admin = list.filter((item) => !favorites.includes(item.id) && groups[item.id] === 'Admin')
    return { pinned, primary, admin }
  }, [visibleOrder, favorites, groups, itemsById])

  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleDrop = (id: string) => {
    if (!draggedId || draggedId === id) return
    const next = [...order]
    const fromIndex = next.indexOf(draggedId)
    const toIndex = next.indexOf(id)
    if (fromIndex === -1 || toIndex === -1) return
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, draggedId)
    setOrder(next)
    setDraggedId(null)
  }

  const toggleHidden = (id: string) => {
    setHidden((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const savePreferences = async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return
    setSaving(true)
    await supabase
      .from('nav_preferences')
      .upsert({
        user_id: authData.user.id,
        collapsed_sections: {
          order,
          hidden,
          favorites,
          compact,
          groups,
        },
      }, { onConflict: 'user_id' })
    setSaving(false)
  }

  const resetPreferences = () => {
    setOrder(defaultOrder)
    setHidden([])
    setFavorites([])
    setCompact(false)
    setGroups(defaultGroups)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-[#2d5016] to-[#1e3610] flex flex-col shadow-2xl">
      {/* Decorative top border */}
      <div className="h-1 bg-gradient-to-r from-[#b8860b] via-[#d4a017] to-[#b8860b]"></div>

      {/* Logo Section */}
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          {/* Crest Logo */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            <img
              src={branding.logoUrl}
              alt={`${branding.programName} crest`}
              className="w-12 h-12 object-contain drop-shadow-md"
            />
            <div className="absolute inset-0 rounded-full bg-[#b8860b] blur-xl opacity-20 -z-10"></div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
              {branding.programName}
            </h1>
            <p className="text-sm text-[#d4a017]/80 font-medium tracking-wide">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${compact ? 'p-4' : 'p-6'} overflow-y-auto`}>
        <p className="text-sm font-semibold text-white/30 tracking-widest mb-4 px-4">Navigation</p>
        <ul className="space-y-1">
          {groupedItems.pinned.length > 0 && (
            <li className="px-4 py-2 text-xs font-semibold tracking-[0.2em] text-[#d4a017]/70">
              Pinned
            </li>
          )}
          {groupedItems.pinned.map((item) => (
            <NavItemRow key={item.id} item={item} pathname={pathname} compact={compact} />
          ))}

          {groupedItems.primary.length > 0 && (
            <li className="px-4 py-2 text-xs font-semibold tracking-[0.2em] text-white/30">
              Primary
            </li>
          )}
          {groupedItems.primary.map((item) => (
            <NavItemRow key={item.id} item={item} pathname={pathname} compact={compact} />
          ))}

          {groupedItems.admin.length > 0 && (
            <li className="px-4 py-2 text-xs font-semibold tracking-[0.2em] text-white/30">
              Admin
            </li>
          )}
          {groupedItems.admin.map((item) => (
            <NavItemRow key={item.id} item={item} pathname={pathname} compact={compact} />
          ))}
        </ul>
      </nav>

      <div className="px-6 pb-6">
        <button
          onClick={() => setCustomizeOpen((prev) => !prev)}
          className="w-full text-sm text-[#d4a017] font-medium py-2 rounded-xl border border-[#b8860b]/30 hover:border-[#b8860b]/60 transition"
        >
          {customizeOpen ? 'Close Customization' : 'Customize Sidebar'}
        </button>
      </div>

      {customizeOpen && (
        <div className="px-6 pb-6 border-t border-white/10">
          <div className="flex items-center justify-between py-4">
            <p className="text-xs text-white/50 tracking-widest">Customize</p>
            <div className="flex gap-2">
              <button
                onClick={resetPreferences}
                className="text-xs text-white/60 hover:text-white transition"
              >
                Reset
              </button>
              <button
                onClick={savePreferences}
                className="text-xs text-[#d4a017] hover:text-[#f3e7b5] transition"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/50">Compact mode</p>
            <button
              onClick={() => setCompact((prev) => !prev)}
              className={`w-10 h-5 rounded-full transition ${compact ? 'bg-[#b8860b]' : 'bg-white/10'}`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transform transition ${compact ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {order.map((id) => {
              const item = itemsById.get(id)
              if (!item) return null
              // Hide super admin only items from customization panel for non-super admins
              if (SUPER_ADMIN_ONLY_ITEMS.includes(id) && !isSuperAdmin) return null
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
                  draggable
                  onDragStart={() => handleDragStart(id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(id)}
                >
                  <span className="text-white/40 cursor-grab">⋮⋮</span>
                  <span className="flex-1">{item.name}</span>
                  <button
                    onClick={() => toggleFavorite(id)}
                    className={`text-sm ${favorites.includes(id) ? 'text-[#d4a017]' : 'text-white/40'}`}
                  >
                    ★
                  </button>
                  <button
                    onClick={() => toggleHidden(id)}
                    className={`text-xs ${hidden.includes(id) ? 'text-rose-300' : 'text-white/40'}`}
                  >
                    {hidden.includes(id) ? 'Hidden' : 'Show'}
                  </button>
                  <select
                    value={groups[id] || 'Primary'}
                    onChange={(event) => setGroups((prev) => ({ ...prev, [id]: event.target.value as 'Primary' | 'Admin' }))}
                    className="bg-white/10 text-white/70 rounded-md px-2 py-1 text-xs"
                  >
                    {groupOptions.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-6 border-t border-white/5">
        <div className="px-4 py-3 rounded-xl bg-white/5">
          <p className="text-sm text-white/40 font-medium tracking-wide">
            {branding.schoolName}
          </p>
          <p className="text-xs text-white/20 mt-1">
            {branding.programShortName}
          </p>
          <p className="text-[11px] text-white/40 mt-2">
            Powered by Nama Learning Systems
          </p>
        </div>
      </div>
    </aside>
  )
}

function NavItemRow({ item, pathname, compact }: { item: NavItem; pathname: string; compact: boolean }) {
  const isActive = pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href))

  return (
    <li>
      <Link
        href={item.href}
        className={`group flex items-center gap-3 ${compact ? 'px-3 py-2.5 text-sm' : 'px-4 py-3.5'} rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-[#b8860b]/20 to-[#b8860b]/5 text-[#f8f9fa] border border-[#b8860b]/25'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        <div className={`p-2 rounded-lg transition-all ${
          isActive
            ? 'bg-[#b8860b]/20'
            : 'bg-white/5 group-hover:bg-white/10'
        }`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
          </svg>
        </div>
        <span className="font-medium">{item.name}</span>
        {isActive && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b8860b]"></div>
        )}
      </Link>
    </li>
  )
}
