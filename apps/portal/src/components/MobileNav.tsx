'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  id: string
  name: string
  href: string
  icon: string
}

type MobileNavProps = {
  open: boolean
  onClose: () => void
  role: 'student' | 'parent' | 'staff'
  portalLabel: string
  showAdmin: boolean
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
  { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.940-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

const adminNavItems: NavItem[] = [
  { id: 'rewards', name: 'Rewards', href: '/dashboard/rewards', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { id: 'analytics', name: 'Analytics', href: '/dashboard/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'staff', name: 'Staff Engagement', href: '/dashboard/staff', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'behaviour', name: 'Behaviour Insights', href: '/dashboard/behaviour', icon: 'M12 3l7 4v6c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V7l7-4zM9 12l2 2 4-4' },
  { id: 'reports', name: 'Reports', href: '/dashboard/reports', icon: 'M9 12h6m-6 4h6M7 8h10M5 20h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v14a2 2 0 002 2z' },
]

export default function MobileNav({
  open,
  onClose,
  role,
  portalLabel,
  showAdmin,
  showStudentsNav = false,
  showBehaviourNav = false,
}: MobileNavProps) {
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <aside className="relative h-full w-72 bg-gradient-to-b from-[#2d5016] to-[#1e3610] shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-[#b8860b] via-[#d4a017] to-[#b8860b]"></div>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              {/* <!-- TODO Phase 3: read from school_settings --> */}
              <img
                src="{{LOGO_URL}}"
                alt="{{PROGRAM_NAME}} crest"
                className="w-10 h-10 object-contain drop-shadow-md"
              />
              <div className="absolute inset-0 rounded-full bg-[#b8860b] blur-xl opacity-20 -z-10"></div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
                {/* <!-- TODO Phase 3: read from school_settings --> */}
                {'{{PROGRAM_NAME}}'}
              </h1>
              <p className="text-xs text-[#d4a017]/80 font-medium tracking-wide" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>
                {portalLabel}
              </p>
            </div>
          </div>
        </div>

        <nav className="p-4 overflow-y-auto" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 px-2">Navigation</p>
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
                    onClick={onClose}
                    className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
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
                  </Link>
                </li>
              )
            })}
          </ul>

          {role === 'staff' && showAdmin ? (
            <>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mt-6 mb-4 px-2">Admin</p>
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
                        onClick={onClose}
                        className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
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
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </nav>
      </aside>
    </div>
  )
}
