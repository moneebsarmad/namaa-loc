'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type DashboardHeaderProps = {
  adminName: string
}

export default function DashboardHeader({ adminName }: DashboardHeaderProps) {
  const router = useRouter()
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-[#B8860B]/10 sticky top-0 z-10">
      <div className="px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#B8860B]"></div>
          <span className="text-sm text-[#1a1a1a]/50 font-medium">{todayLabel}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3d6b1e] to-[#1e3610] flex items-center justify-center text-white text-sm font-semibold shadow-md">
              {adminName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-[#1a1a1a]">{adminName}</p>
              <p className="text-sm text-[#1a1a1a]/40">Administrator</p>
            </div>
          </div>
          <div className="w-px h-8 bg-[#1a1a1a]/10"></div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-[#1a1a1a]/50 hover:text-[#8b6508] font-medium transition-colors"
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
