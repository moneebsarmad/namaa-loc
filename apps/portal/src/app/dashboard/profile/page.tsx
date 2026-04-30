'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../providers'
import { supabase } from '../../../lib/supabaseClient'
import CrestLoader from '../../../components/CrestLoader'
import { canonicalHouseName } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface StudentProfile {
  name: string
  grade: number
  section: string
  house: string
}

interface MeritEntry {
  points: number
  r: string
  subcategory: string
  timestamp: string
  staffName: string
  domain_id: number | null
}

interface Domain {
  id: number
  display_name: string
}

interface BadgeLeader {
  quarter: string
  category: string
  totalPoints: number
}

interface HouseMvpEntry {
  house: string
  points: number
}

const GOALS_STORAGE_KEY = 'portal:student-goals'
const DEFAULT_WEEKLY_GOAL = 100
const MILESTONE_CLOSE_GAP = 20
const MVP_CLOSE_GAP = 20

const quarterlyBadges = [
  { name: 'The Honour Guard', category: 'Respect', icon: '🛡️', description: 'Most points in Respect category' },
  { name: 'The Keeper', category: 'Responsibility', icon: '🔑', description: 'Most points in Responsibility category' },
  { name: 'The Light Bearer', category: 'Righteousness', icon: '🕯️', description: 'Most points in Righteousness category' },
]

const milestones = [
  { name: 'Century Club', points: 100, icon: '💯' },
  { name: 'Badr Club', points: 300, icon: '🌙' },
  { name: 'Fath Club', points: 700, icon: '🏆' },
]

function getFirstName(fullName: string): string {
  return fullName.trim().split(' ')[0] || fullName
}

function getStartOfWeek(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(now.setDate(diff))
}

function loadGoals(): { weekly: number; monthly: number; quarterly: number } {
  if (typeof window === 'undefined') return { weekly: DEFAULT_WEEKLY_GOAL, monthly: 400, quarterly: 1200 }
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore
  }
  return { weekly: DEFAULT_WEEKLY_GOAL, monthly: 400, quarterly: 1200 }
}

function saveGoals(goals: { weekly: number; monthly: number; quarterly: number }) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals))
  } catch {
    // Ignore
  }
}

function getCurrentQuarterRange() {
  const today = new Date()
  const year = today.getFullYear()
  const q1 = {
    start: new Date(year, 0, 6),
    end: new Date(year, 2, 6, 23, 59, 59, 999),
  }
  const q2 = {
    start: new Date(year, 2, 9),
    end: new Date(year, 4, 21, 23, 59, 59, 999),
  }
  if (today >= q1.start && today <= q1.end) return { ...q1, id: 'q1' as const }
  if (today >= q2.start && today <= q2.end) return { ...q2, id: 'q2' as const }
  return { ...q2, id: 'q2' as const }
}

function isMissingRelation(error: { message?: string | null } | null) {
  const message = error?.message || ''
  return message.includes('does not exist') || message.includes('Could not find the table')
}

export default function MyPointsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [merits, setMerits] = useState<MeritEntry[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [badgeLeaders, setBadgeLeaders] = useState<BadgeLeader[]>([])
  const [houseMvp, setHouseMvp] = useState<HouseMvpEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState(loadGoals)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(goals.weekly.toString())

  useEffect(() => {
    if (!userId) return
    if (!currentSchoolId) {
      setLoading(false)
      return
    }

    const loadProfile = async () => {
      setLoading(true)
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('linked_student_id')
        .eq('id', userId)
        .eq('school_id', currentSchoolId)
        .maybeSingle()

      if (error || !profileData?.linked_student_id) {
        setProfile(null)
        setMerits([])
        setLoading(false)
        return
      }

      // Fetch student, merits, and domains in parallel
      const [studentRes, meritRes, domainsRes] = await Promise.all([
        supabase
          .from('students')
          .select('student_name, grade, section, house')
          .eq('student_id', profileData.linked_student_id)
          .eq('school_id', currentSchoolId)
          .maybeSingle(),
        supabase
          .from('merit_log')
          .select('*')
          .eq('student_id', profileData.linked_student_id)
          .eq('school_id', currentSchoolId)
          .order('timestamp', { ascending: false }),
        supabase
          .from('merit_domains')
          .select('id, display_name')
          .eq('is_active', true),
      ])

      const student = studentRes.data
      if (!student?.student_name) {
        setProfile(null)
        setMerits([])
        setLoading(false)
        return
      }

      setProfile({
        name: String(student.student_name ?? '').trim(),
        grade: Number(student.grade ?? 0),
        section: String(student.section ?? ''),
        house: String(student.house ?? ''),
      })

      setMerits((meritRes.data || []).map((m) => ({
        points: m.points || 0,
        r: m.r || '',
        subcategory: m.subcategory || '',
        timestamp: m.timestamp || '',
        staffName: m.staff_name || '',
        domain_id: m.domain_id || null,
      })))

      setDomains((domainsRes.data || []).map((d) => ({
        id: d.id,
        display_name: d.display_name || '',
      })))

      setLoading(false)
    }

    loadProfile()
  }, [currentSchoolId, userId])

  useEffect(() => {
    if (!profile?.house) return

    const fetchHouseMvp = async () => {
      const { data, error } = await supabase
        .from('house_mvp_monthly')
        .select('house, points, rank')
        .eq('school_id', currentSchoolId)

      if (error) {
        if (isMissingRelation(error)) {
          setHouseMvp(null)
          return
        }
        console.error('Error fetching house MVP:', error)
        setHouseMvp(null)
        return
      }

      const row = (data || []).find(
        (entry: Record<string, unknown>) =>
          String(entry.house ?? '') === profile.house && Number(entry.rank ?? 0) === 1
      )
      if (!row) {
        setHouseMvp(null)
        return
      }
      setHouseMvp({
        house: String(row.house ?? ''),
        points: Number(row.points ?? 0),
      })
    }

    const fetchBadgeLeaders = async () => {
      const { data, error } = await supabase
        .from('quarterly_badge_leaders')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        if (isMissingRelation(error)) {
          setBadgeLeaders([])
          return
        }
        console.error('Error fetching badge leaders:', error)
        setBadgeLeaders([])
        return
      }

      const normalizeQuarter = (value: string) => {
        const raw = value.toLowerCase().replace(/\s+/g, '')
        if (raw.startsWith('q1')) return 'q1'
        if (raw.startsWith('q2')) return 'q2'
        return raw
      }

      const currentQuarter = getCurrentQuarterRange()
      const leaders: BadgeLeader[] = (data || [])
        .map((row: Record<string, unknown>) => ({
          quarter: String(row.quarter ?? ''),
          category: String(row.category ?? ''),
          totalPoints: Number(row.total_points ?? row.totalPoints ?? 0),
          rank: Number(row.rank ?? 0),
        }))
        .filter((row) => normalizeQuarter(row.quarter) === currentQuarter.id && row.rank === 1)
        .map(({ quarter, category, totalPoints }) => ({ quarter, category, totalPoints }))

      setBadgeLeaders(leaders)
    }

    fetchHouseMvp()
    fetchBadgeLeaders()
  }, [currentSchoolId, profile?.house])

  const totalPoints = useMemo(
    () => merits.reduce((sum, entry) => sum + entry.points, 0),
    [merits]
  )

  const weeklyPoints = useMemo(() => {
    const weekStart = getStartOfWeek()
    return merits
      .filter((m) => new Date(m.timestamp) >= weekStart)
      .reduce((sum, m) => sum + m.points, 0)
  }, [merits])

  const quarterRange = useMemo(getCurrentQuarterRange, [])

  const quarterMerits = useMemo(
    () => merits.filter((m) => {
      const date = new Date(m.timestamp)
      return date >= quarterRange.start && date <= quarterRange.end
    }),
    [merits, quarterRange]
  )

  const quarterPoints = useMemo(
    () => quarterMerits.reduce((sum, entry) => sum + entry.points, 0),
    [quarterMerits]
  )

  const monthPoints = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return merits
      .filter((m) => new Date(m.timestamp) >= monthStart)
      .reduce((sum, m) => sum + m.points, 0)
  }, [merits])

  const mostRecentMerit = merits[0] || null

  const getDomainName = (domainId: number | null): string => {
    if (!domainId) return 'achievement'
    const domain = domains.find((d) => d.id === domainId)
    return domain?.display_name?.toLowerCase() || 'achievement'
  }

  const handleSaveGoal = () => {
    const newWeekly = Math.max(1, parseInt(editingGoal) || DEFAULT_WEEKLY_GOAL)
    const newGoals = { ...goals, weekly: newWeekly }
    setGoals(newGoals)
    saveGoals(newGoals)
    setShowGoalModal(false)
  }

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    merits.forEach((entry) => {
      const key = String(entry.r || '').trim() || 'Other'
      totals.set(key, (totals.get(key) || 0) + entry.points)
    })
    return totals
  }, [merits])

  const quarterCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    quarterMerits.forEach((entry) => {
      const key = String(entry.r || '').trim() || 'Other'
      totals.set(key, (totals.get(key) || 0) + entry.points)
    })
    return totals
  }, [quarterMerits])

  const domainTotals = useMemo(() => {
    const totals = new Map<string, number>()
    merits.forEach((entry) => {
      const name = getDomainName(entry.domain_id)
      totals.set(name, (totals.get(name) || 0) + entry.points)
    })
    return Array.from(totals.entries())
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
  }, [merits, domains])

  const badgeLeaderMap = useMemo(() => {
    const map = new Map<string, number>()
    badgeLeaders.forEach((leader) => {
      if (!leader.category) return
      map.set(leader.category, leader.totalPoints)
    })
    return map
  }, [badgeLeaders])

  const milestoneStatus = useMemo(() => {
    return milestones.map((milestone) => {
      const pointsNeeded = Math.max(0, milestone.points - quarterPoints)
      return {
        ...milestone,
        pointsNeeded,
        achieved: pointsNeeded === 0,
        close: pointsNeeded > 0 && pointsNeeded <= MILESTONE_CLOSE_GAP,
      }
    })
  }, [quarterPoints])

  const houseMvpGap = useMemo(() => {
    if (!houseMvp) return null
    return Math.max(0, houseMvp.points - monthPoints)
  }, [houseMvp, monthPoints])

  if (loading || housesLoading) {
    return <CrestLoader label="Loading your profile..." />
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#B8860B]/10 text-center">
        <p className="text-[#1a1a1a]/70 font-medium">We couldn't find your student profile yet.</p>
        <p className="text-sm text-[#1a1a1a]/45 mt-2">Please contact the office to link your account.</p>
      </div>
    )
  }

  const progressPercent = Math.min(100, (weeklyPoints / goals.weekly) * 100)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Avatar Section */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 rounded-full bg-[#2D5016] flex items-center justify-center mb-4 shadow-lg" style={{ border: '4px solid #3d6b1e' }}>
          <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          {profile.name}
        </h1>
        <p className="text-[#1a1a1a]/50">{canonicalHouseName(profile.house, schoolHouses)}</p>
      </div>

      {/* Recent Recognition Card */}
      {mostRecentMerit && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-start gap-4">
            {/* Hexagon Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#2D5016]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[#2D5016]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18l6 3.33v6.98l-6 3.33-6-3.33V7.51l6-3.33z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1a1a1a] text-lg">
                Great {getDomainName(mostRecentMerit.domain_id)} adab, {getFirstName(profile.name)}!
              </p>
              <p className="text-sm text-[#1a1a1a]/50 mt-1">
                {mostRecentMerit.subcategory || mostRecentMerit.r}
              </p>
            </div>
          </div>

          {/* Points Badge */}
          <div className="mt-4 flex justify-center">
            <div className="inline-flex items-center gap-2 bg-[#B8860B]/10 px-4 py-2 rounded-full">
              <svg className="w-5 h-5 text-[#B8860B]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21L12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
              </svg>
              <span className="font-bold text-[#B8860B]">+{mostRecentMerit.points} Points</span>
              <span className="text-[#1a1a1a]/50">for {canonicalHouseName(profile.house, schoolHouses)?.replace('House of ', '')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10 text-center">
          <p className="text-xs text-[#1a1a1a]/50 mb-1">Total Points (All Time)</p>
          <p className="text-2xl font-bold text-[#2D5016]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {totalPoints}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10 text-center">
          <p className="text-xs text-[#1a1a1a]/50 mb-1">Points This Quarter</p>
          <p className="text-2xl font-bold text-[#2D5016]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {quarterPoints}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10 text-center">
          <p className="text-xs text-[#1a1a1a]/50 mb-1">Points This Month</p>
          <p className="text-2xl font-bold text-[#2D5016]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {monthPoints}
          </p>
        </div>
      </div>

      {/* Weekly Progress */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1a1a1a]">Weekly Progress</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#1a1a1a]/50">{weeklyPoints} / {goals.weekly} pts</span>
            <button
              onClick={() => {
                setEditingGoal(goals.weekly.toString())
                setShowGoalModal(true)
              }}
              className="text-[#B8860B] hover:text-[#8b6508] transition-colors"
              title="Set goal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #2D5016 0%, #B8860B 100%)',
            }}
          />
        </div>
        {weeklyPoints >= goals.weekly && (
          <p className="text-sm text-[#055437] font-medium mt-2 text-center">
            Goal achieved! Great work this week!
          </p>
        )}
      </div>

      {/* 3Rs Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1a1a1a]">Your 3R Totals</h3>
          <p className="text-xs text-[#1a1a1a]/45">All time</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Respect', 'Responsibility', 'Righteousness'].map((category) => (
            <div key={category} className="rounded-xl border border-[#1a1a1a]/10 p-4 bg-[#fdfbf6]">
              <p className="text-xs uppercase tracking-wide text-[#1a1a1a]/50">{category}</p>
              <p className="text-2xl font-bold text-[#2D5016] mt-2">
                {(categoryTotals.get(category) || 0).toLocaleString()} pts
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Points by Domain */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1a1a1a]">Points by Domain</h3>
          <p className="text-xs text-[#1a1a1a]/45">All time</p>
        </div>
        {domainTotals.length === 0 ? (
          <p className="text-sm text-[#1a1a1a]/45">No domain points yet.</p>
        ) : (
          <div className="space-y-3">
            {domainTotals.map((domain) => (
              <div key={domain.name} className="flex items-center justify-between rounded-xl border border-[#1a1a1a]/10 px-4 py-3">
                <span className="text-sm font-medium text-[#1a1a1a] capitalize">{domain.name}</span>
                <span className="text-sm font-semibold text-[#2D5016]">{domain.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1a1a1a]">Milestones This Quarter</h3>
          <p className="text-xs text-[#1a1a1a]/45">Based on {quarterPoints} pts</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {milestoneStatus.map((milestone) => (
            <div key={milestone.name} className="rounded-xl border border-[#1a1a1a]/10 p-4 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{milestone.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{milestone.name}</p>
                  <p className="text-xs text-[#1a1a1a]/50">{milestone.points} pts</p>
                </div>
              </div>
              <div className="mt-3 text-sm">
                {milestone.achieved ? (
                  <span className="text-[#055437] font-semibold">Unlocked</span>
                ) : milestone.close ? (
                  <span className="text-[#B8860B] font-semibold">{milestone.pointsNeeded} pts to go</span>
                ) : (
                  <span className="text-[#1a1a1a]/50">{milestone.pointsNeeded} pts to go</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MVP Tracker */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <h3 className="font-semibold text-[#1a1a1a] mb-2">House MVP Chase</h3>
        {!houseMvp ? (
          <p className="text-sm text-[#1a1a1a]/45">House MVP data not available yet.</p>
        ) : houseMvpGap === 0 ? (
          <p className="text-sm text-[#055437] font-semibold">You are currently your house MVP this month.</p>
        ) : (
          <p className="text-sm text-[#1a1a1a]/70">
            You are {houseMvpGap} pts behind the top score in {canonicalHouseName(profile.house, schoolHouses)} this month.
            {houseMvpGap !== null && houseMvpGap <= MVP_CLOSE_GAP && (
              <span className="text-[#B8860B] font-semibold"> You are close!</span>
            )}
          </p>
        )}
      </div>

      {/* Badge Chase */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1a1a1a]">Quarterly Badge Chase</h3>
          <p className="text-xs text-[#1a1a1a]/45">Based on this quarter</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quarterlyBadges.map((badge) => {
            const studentPoints = quarterCategoryTotals.get(badge.category) || 0
            const leaderPoints = badgeLeaderMap.get(badge.category) ?? null
            const pointsNeeded = leaderPoints === null ? null : Math.max(0, leaderPoints - studentPoints)
            return (
              <div key={badge.name} className="rounded-xl border border-[#1a1a1a]/10 p-4 bg-[#fdfbf6]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{badge.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">{badge.name}</p>
                    <p className="text-xs text-[#1a1a1a]/50">{badge.category}</p>
                  </div>
                </div>
                <p className="text-sm text-[#1a1a1a]/70">{studentPoints} pts in {badge.category}</p>
                {pointsNeeded === null ? (
                  <p className="text-xs text-[#1a1a1a]/45 mt-2">Leaderboard data unavailable.</p>
                ) : pointsNeeded === 0 ? (
                  <p className="text-xs text-[#055437] font-semibold mt-2">You are leading this badge.</p>
                ) : (
                  <p className="text-xs text-[#1a1a1a]/50 mt-2">
                    {pointsNeeded} pts to catch the top score.
                    {pointsNeeded <= MILESTONE_CLOSE_GAP && <span className="text-[#B8860B] font-semibold"> Close!</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Goal Setting Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Set Weekly Goal</h3>
            <input
              type="number"
              min="1"
              value={editingGoal}
              onChange={(e) => setEditingGoal(e.target.value)}
              className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none mb-4"
              placeholder="Enter weekly goal"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 py-3 px-4 border border-[#1a1a1a]/10 rounded-xl text-[#1a1a1a]/70 font-medium hover:bg-[#faf9f7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#B8860B] to-[#8b6508] text-white rounded-xl font-medium hover:from-[#8b6508] hover:to-[#7a5f14] transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
