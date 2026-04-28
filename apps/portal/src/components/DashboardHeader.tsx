'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../app/providers'

type DashboardHeaderProps = {
  userName: string
  role: 'student' | 'parent' | 'staff'
  onMenuClick?: () => void
  showMenuButton?: boolean
}

function roleLabel(role: 'student' | 'parent' | 'staff') {
  switch (role) {
    case 'student':
      return 'Student'
    case 'parent':
      return 'Parent'
    case 'staff':
      return 'Staff'
    default:
      return 'User'
  }
}

function initials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/).slice(0, 2)
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

export default function DashboardHeader({
  userName,
  role,
  onMenuClick,
  showMenuButton = false,
}: DashboardHeaderProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#b8860b]/10 sticky top-0 z-10" style={{ fontFamily: 'var(--font-body), Source Sans 3, sans-serif' }}>
      <div className="px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showMenuButton ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-xl border border-[#1a1a1a]/10 text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:border-[#b8860b]/50 transition-colors"
              aria-label="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : null}
          <div className="w-2 h-2 rounded-full bg-[#b8860b]"></div>
          <span className="text-sm text-[#1a1a1a]/50 font-medium">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3d6b1e] to-[#1e3610] flex items-center justify-center text-white text-sm font-semibold shadow-md">
              {initials(userName)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">{userName}</p>
              <p className="text-xs text-[#1a1a1a]/40">{roleLabel(role)}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-[#1a1a1a]/10"></div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-[#1a1a1a]/50 hover:text-[#8b6508] font-medium transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
