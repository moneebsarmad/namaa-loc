'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  id: string
  name: string
  href: string
  icon: string
}

type SidebarProps = {
  role: 'student' | 'parent' | 'staff'
  portalLabel: string
  showAdmin?: boolean
  showStudentsNav?: boolean
  showBehaviourNav?: boolean
}

const studentNavItems: NavItem[] = [
  { id: 'leaderboard', name: 'Leaderboard', href: '/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'profile', name: 'My Points', href: '/dashboard/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'house', name: 'My House', href: '/dashboard/house', icon: 'M3 10l9-6 9 6v9a2 2 0 01-2 2h-4a2 2 0 01-2-2v-5H9v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z' },
  { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

const parentNavItems: NavItem[] = [
  { id: 'leaderboard', name: 'Leaderboard', href: '/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'students', name: 'My Children', href: '/dashboard/students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

const staffNavItems: NavItem[] = [
  { id: 'leaderboard', name: 'Leaderboard', href: '/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'students', name: 'Students', href: '/dashboard/students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'add-points', name: 'Add Points', href: '/dashboard/add-points', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

const adminNavItems: NavItem[] = [
  { id: 'rewards', name: 'Rewards', href: '/dashboard/rewards', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { id: 'analytics', name: 'Analytics', href: '/dashboard/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'tier2-analytics', name: 'System Health', href: '/dashboard/tier2-analytics', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'culture-health', name: 'Culture Health', href: '/dashboard/culture-health', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { id: 'staff', name: 'Staff Engagement', href: '/dashboard/staff', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'behaviour', name: 'Behaviour Insights', href: '/dashboard/behaviour', icon: 'M12 3l7 4v6c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V7l7-4zM9 12l2 2 4-4' },
  { id: 'reports', name: 'Reports', href: '/dashboard/reports', icon: 'M9 12h6m-6 4h6M7 8h10M5 20h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v14a2 2 0 002 2z' },
]

export default function Sidebar({
  role,
  portalLabel,
  showAdmin = false,
  showStudentsNav = false,
  showBehaviourNav = false,
}: SidebarProps) {
  const pathname = usePathname()

  const navItems = role === 'staff'
    ? staffNavItems.filter((item) => {
        if (showAdmin && item.id === 'add-points') return false
        if (!showStudentsNav && item.id === 'students') return false
        return true
      })
    : role === 'parent'
      ? parentNavItems
      : studentNavItems

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-[#2d5016] to-[#1e3610] flex flex-col shadow-2xl z-50">
      {/* Decorative top border */}
      <div className="h-1 bg-gradient-to-r from-[#b8860b] via-[#d4a017] to-[#b8860b]"></div>

      {/* Logo Section */}
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          {/* Crest Logo */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            {/* <!-- TODO Phase 3: read from school_settings --> */}
            <img
              src="{{LOGO_URL}}"
              alt="{{PROGRAM_NAME}} crest"
              className="w-12 h-12 object-contain drop-shadow-md"
            />
            <div className="absolute inset-0 rounded-full bg-[#b8860b] blur-xl opacity-20 -z-10"></div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
              {/* <!-- TODO Phase 3: read from school_settings --> */}
              {'{{PROGRAM_NAME}}'}
            </h1>
            <p className="text-sm text-[#d4a017]/80 font-medium tracking-wide" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>{portalLabel}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 overflow-y-auto" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 px-4">Navigation</p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            const displayName =
              role === 'staff' && showAdmin && item.id === 'leaderboard'
                ? 'Overview'
                : item.name

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
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
                  <span className="font-medium">{displayName}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b8860b]"></div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {role === 'staff' && showAdmin ? (
          <>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mt-8 mb-4 px-4">Admin</p>
            <ul className="space-y-1">
              {adminNavItems.map((item) => {
                if (item.id === 'behaviour' && !showBehaviourNav) {
                  return null
                }
                const isActive = pathname === item.href || pathname?.startsWith(item.href)

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
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
              })}
            </ul>
          </>
        ) : null}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-white/5" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>
        <div className="px-4 py-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40 font-medium tracking-wide">
            {/* <!-- TODO Phase 3: read from school_settings --> */}
            {'{{SCHOOL_NAME}}'}
          </p>
          <p className="text-xs text-white/20 mt-1">
            {/* <!-- TODO Phase 3: read from school_settings --> */}
            {'{{PROGRAM_TAGLINE}}'}
          </p>
          <p className="text-[11px] text-white/40 mt-2">
            {/* <!-- TODO Phase 3: read from school_settings --> */}
            Powered by {'{{PROVIDER_NAME}}'}
          </p>
        </div>
      </div>
    </aside>
  )
}
