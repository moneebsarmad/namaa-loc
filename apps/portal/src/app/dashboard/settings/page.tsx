'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../providers'
import { supabase } from '../../../lib/supabaseClient'
import CrestLoader from '../../../components/CrestLoader'
import { useSessionStorageState } from '../../../hooks/useSessionStorageState'
import { mapDbRoleToPortalRole, type PortalRole as Role } from '@/lib/portalRoles'

type ToggleOption = {
  key: string
  label: string
  helper?: string
}

type SettingsSection = {
  title: string
  description: string
  options: ToggleOption[]
}

function RoleBadge({ role }: { role: Role }) {
  const label = role === 'staff' ? 'Staff Portal' : role === 'parent' ? 'Parent Portal' : 'Student Portal'
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#B8860B]/15 text-[#8b6508]">
      {label}
    </span>
  )
}

function ToggleRow({
  label,
  helper,
  enabled,
  onToggle,
}: {
  label: string
  helper?: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-[#1a1a1a]">{label}</p>
        {helper ? (
          <p className="text-xs text-[#1a1a1a]/45 mt-1">{helper}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-[#B8860B]' : 'bg-[#1a1a1a]/15'}`}
        aria-pressed={enabled}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const [role, setRole] = useState<Role | null>(null)
  const [dbRole, setDbRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggles, setToggles] = useSessionStorageState<Record<string, boolean>>('portal:settings:toggles', {})
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (!currentSchoolId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      setLoading(true)

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .eq('school_id', currentSchoolId)
        .maybeSingle()

      if (profileData?.role) {
        setRole(mapDbRoleToPortalRole(profileData.role))
        setDbRole(profileData.role)
      }

      // Load saved settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle()

      if (settingsData?.settings) {
        setToggles(settingsData.settings as Record<string, boolean>)
      }

      setLoading(false)
    }

    loadData()
  }, [currentSchoolId, userId])

  const sections = useMemo<SettingsSection[]>(() => {
    if (!role) return []

    if (role === 'staff') {
      return [
        {
          title: 'Notifications',
          description: 'Control staff updates and point alerts.',
          options: [
            { key: 'staff_daily_digest', label: 'Daily merit digest', helper: 'Get a summary of points awarded each day.' },
            { key: 'staff_student_changes', label: 'Student activity alerts', helper: 'Be notified when new merit points are logged.' },
          ],
        },
        {
          title: 'Classroom Tools',
          description: 'Keep quick actions close at hand.',
          options: [
            { key: 'staff_quick_add', label: 'Enable quick-add panel', helper: 'Show fast student search when awarding points.' },
            { key: 'staff_recent_filters', label: 'Remember last category', helper: 'Keep your last selection for faster entry.' },
          ],
        },
      ]
    }

    if (role === 'parent') {
      return [
        {
          title: 'Family Updates',
          description: 'Choose how often you receive student updates.',
          options: [
            { key: 'parent_weekly_digest', label: 'Weekly summary email', helper: 'Receive a recap every Friday.' },
            { key: 'parent_points_alerts', label: 'Points awarded alerts', helper: 'Get notified when new points are added.' },
          ],
        },
        {
          title: 'Privacy',
          description: 'Manage how your child appears on leaderboards.',
          options: [
            { key: 'parent_hide_full_name', label: 'Hide full name', helper: 'Show initials only on public boards.' },
          ],
        },
      ]
    }

    return [
      {
        title: 'Progress Updates',
        description: 'Stay on top of your points and milestones.',
        options: [
          { key: 'student_weekly_summary', label: 'Weekly progress summary', helper: 'Get a weekly recap of your points.' },
          { key: 'student_badge_alerts', label: 'Badge reminders', helper: 'Be notified when you are close to a badge.' },
        ],
      },
      {
        title: 'Privacy',
        description: 'Control how you appear to others.',
        options: [
          { key: 'student_hide_full_name', label: 'Show initials only', helper: 'Use initials on public leaderboards.' },
        ],
      },
    ]
  }, [role])

  const handleToggle = async (key: string) => {
    const newToggles = { ...toggles, [key]: !toggles[key] }
    setToggles(newToggles)

    // Save to database
    setSaving(true)
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user?.id,
        settings: newToggles,
      }, { onConflict: 'user_id' })
    setSaving(false)
  }

  const handleResetPassword = async () => {
    if (!user?.email) return
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (error) {
        alert('Error sending reset email: ' + error.message)
      } else {
        alert('Password reset email sent! Check your inbox.')
      }
    } catch (err) {
      alert('Failed to send reset email')
    }
    setResetting(false)
  }

  const handleRedeemInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteCode.trim()) return
    setRedeeming(true)
    setInviteStatus(null)

    const { error } = await supabase.rpc('redeem_student_invite_code', {
      code_text: inviteCode.trim(),
    })

    if (error) {
      setInviteStatus({ type: 'error', message: error.message })
    } else {
      setInviteStatus({ type: 'success', message: 'Student linked successfully.' })
      setInviteCode('')
    }

    setRedeeming(false)
  }

  if (loading || !role) {
    return (
      <CrestLoader label="Loading settings..." />
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
            Settings
          </h1>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Manage your portal preferences.</p>
        </div>
        <RoleBadge role={role} />
      </div>

      <div className="grid gap-6">
        {/* Account */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-1">Account</h2>
              <p className="text-sm text-[#1a1a1a]/50">Basic profile information for this portal.</p>
            </div>
            <div className="text-sm text-[#1a1a1a]/70 text-right">
              <p className="font-semibold text-[#1a1a1a]">{user?.email}</p>
              <p className="text-xs text-[#1a1a1a]/45 mt-1">Role: {dbRole || role}</p>
            </div>
          </div>
        </div>

        {role === 'parent' ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Link a Student</h2>
              <p className="text-sm text-[#1a1a1a]/50">Enter the student code emailed to you to connect your account.</p>
            </div>
            <form onSubmit={handleRedeemInvite} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="Enter student code"
                className="flex-1 px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={redeeming || !inviteCode.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#B8860B] text-white font-semibold shadow-sm hover:bg-[#b58f20] transition-colors disabled:opacity-60"
              >
                {redeeming ? 'Linking...' : 'Link Student'}
              </button>
            </form>
            {inviteStatus ? (
              <p
                className={`text-sm mt-3 ${inviteStatus.type === 'success' ? 'text-[#0b6b3a]' : 'text-[#910000]'}`}
              >
                {inviteStatus.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Toggle Sections */}
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">{section.title}</h2>
              <p className="text-sm text-[#1a1a1a]/50">{section.description}</p>
            </div>
            <div className="space-y-4">
              {section.options.map((option) => (
                <ToggleRow
                  key={option.key}
                  label={option.label}
                  helper={option.helper}
                  enabled={Boolean(toggles[option.key])}
                  onToggle={() => handleToggle(option.key)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Security */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-1">Security</h2>
          <p className="text-sm text-[#1a1a1a]/50 mb-4">Manage your account security.</p>
          <button
            onClick={handleResetPassword}
            disabled={resetting}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#2a2a3e] transition disabled:opacity-50"
          >
            {resetting ? 'Sending...' : 'Reset Password'}
          </button>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg">
          Saving...
        </div>
      )}
    </div>
  )
}
