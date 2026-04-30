'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CrestLoader from '../../components/CrestLoader'
import { useAuth } from '../providers'
import { useUserRole } from '../../hooks/usePermissions'
import { Tables } from '../../lib/supabase/tables'
import { normalizeHouseStandingsRows, normalizeTopStudentsRows } from '@/lib/leaderboardViewRows'
import { canonicalHouseName, getHouseConfigRecord, getHouseNames } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

type LeaderboardEntry = {
  house: string
  totalPoints: number
}

interface HouseData {
  name: string
  points: number
  color: string
  gradient: string
  logo: string
  percentage: number
}

interface AdminHouseData {
  name: string
  points: number
  color: string
  gradient: string
  accentGradient: string
  logo: string
  percentage: number
  topStudents: { name: string; points: number }[]
}

function AdminOverviewDashboard() {
  const { user } = useAuth()
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [houses, setHouses] = useState<AdminHouseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const houseConfig = useMemo(() => getHouseConfigRecord(schoolHouses), [schoolHouses])
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])

  useEffect(() => {
    if (!currentSchoolId) {
      setIsLoading(false)
      return
    }
    fetchDashboardData()
  }, [currentSchoolId])

  useEffect(() => {
    if (!currentSchoolId) return
    const channel = supabase
      .channel('dashboard-overview')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: Tables.meritLog, filter: `school_id=eq.${currentSchoolId}` },
        () => {
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchoolId])

  const fetchDashboardData = async () => {
    if (!currentSchoolId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [standingsRes, cacheRes, topStudentsRes] = await Promise.all([
        supabase
          .from('house_standings_view')
          .select('*')
          .eq('school_id', currentSchoolId),
        supabase
          .from('house_standings_cache')
          .select('computed_at')
          .eq('school_id', currentSchoolId)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('top_students_per_house')
          .select('*')
          .eq('school_id', currentSchoolId),
      ])

      if (standingsRes.error) {
        throw standingsRes.error
      }

      if (cacheRes.error) {
        console.error('Error fetching standings cache timestamp:', cacheRes.error)
      }

      const housePoints: Record<string, number> = {}
      normalizeHouseStandingsRows((standingsRes.data || []) as Record<string, unknown>[]).forEach((row) => {
        const house = row.house ? canonicalHouseName(row.house, schoolHouses) : ''
        if (!house) return
        housePoints[house] = row.totalPoints
      })

      if (cacheRes.data?.computed_at) {
        setLastUpdated(String(cacheRes.data.computed_at))
      } else {
        setLastUpdated(null)
      }

      const houseStudents: Record<string, { name: string; points: number; rank?: number | null }[]> = {}
      if (topStudentsRes.error) {
        console.error('Error fetching top students per house:', topStudentsRes.error)
      }
      normalizeTopStudentsRows((topStudentsRes.data || []) as Record<string, unknown>[]).forEach((row) => {
        const house = row.house ? canonicalHouseName(row.house, schoolHouses) : ''
        if (!house) return
        if (!houseStudents[house]) {
          houseStudents[house] = []
        }
        houseStudents[house].push({
          name: row.studentName,
          points: row.totalPoints,
          rank: row.rank,
        })
      })

      Object.keys(houseStudents).forEach((house) => {
        houseStudents[house].sort((a, b) => {
          const rankA = Number.isFinite(a.rank ?? NaN) ? (a.rank as number) : Number.POSITIVE_INFINITY
          const rankB = Number.isFinite(b.rank ?? NaN) ? (b.rank as number) : Number.POSITIVE_INFINITY
          if (rankA !== rankB) return rankA - rankB
          return b.points - a.points
        })
      })

      const totalPoints = Object.values(housePoints).reduce((a, b) => a + b, 0)

      const houseData: AdminHouseData[] = (houseNames.length ? houseNames : Object.keys(houseConfig)).map((name) => {
        const config = houseConfig[name] ?? {
          color: '#1a1a1a',
          gradient: 'linear-gradient(135deg, #2a2a4e 0%, #1a1a1a 100%)',
          accentGradient: 'linear-gradient(135deg, #2a2a4e 0%, #1a1a1a 100%)',
          logo: '/crest.png',
        }

        return {
          name,
          points: housePoints[name] || 0,
          color: config.color,
          gradient: config.gradient,
          accentGradient: config.accentGradient,
          logo: config.logo,
          percentage: totalPoints > 0 ? ((housePoints[name] || 0) / totalPoints) * 100 : 0,
          topStudents: (houseStudents[name] || []).slice(0, 5).map((student) => ({
            name: student.name,
            points: student.points,
          })),
        }
      })

      houseData.sort((a, b) => b.points - a.points)
      setHouses(houseData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshStandings = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/admin/recompute-house-standings', { method: 'POST' })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error || 'Failed to refresh standings.'
        throw new Error(message)
      }
      await fetchDashboardData()
    } catch (error) {
      console.error('Error refreshing house standings:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const header = (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
        Overview
      </h1>
      <div className="flex items-center gap-3">
        <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
        <p className="text-[#1a1a1a]/50 text-sm font-medium">House standings and top performers</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleRefreshStandings}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-[#1a1a1a]/10 bg-white shadow-sm hover:bg-[#faf9f7] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh House Standings'}
        </button>
        <span className="text-xs text-[#1a1a1a]/50">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not available'}
        </span>
      </div>
    </div>
  )

  if (isLoading || housesLoading) {
    return (
      <div>
        {header}
        <CrestLoader label="Loading overview..." />
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* House Cards */}
      <div className="space-y-6">
        {houses.map((house, index) => (
          <div
            key={house.name}
            className="rounded-2xl overflow-hidden shadow-xl relative"
            style={{ background: house.gradient }}
          >
            <div className="p-6 relative z-10">
              {/* House Header */}
              <div className="flex items-start justify-between gap-6 mb-5">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm tracking-[0.15em] font-semibold text-white/70 bg-white/10 border border-white/15 px-3 py-1.5 rounded-full mb-4">
                    <span className="text-white/50">Rank</span>
                    <span className="text-white">{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm p-1.5 shadow-lg border border-white/10">
                      <img
                        src={house.logo}
                        alt={house.name}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {house.name}
                    </h2>
                  </div>
                  {/* Progress bar */}
                  <div className="w-64 h-2.5 bg-white/20 rounded-full overflow-hidden mb-2 backdrop-blur-sm">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${house.percentage}%`,
                        background: 'linear-gradient(90deg, #B8860B 0%, #d4a017 50%, #B8860B 100%)',
                      }}
                    />
                  </div>
                  <p className="text-white/60 text-base font-medium">{house.percentage.toFixed(1)}% of total points</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2 min-w-[150px] pt-4">
                  <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                    {house.points.toLocaleString()}
                  </p>
                  <p className="text-white/50 text-lg font-medium">Total Points</p>
                </div>
              </div>

              {/* Top Students */}
              <div className="mt-6">
                <p className="text-white/50 text-base font-semibold tracking-widest mb-4">Top Performers</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {house.topStudents.map((student, index) => (
                    <div
                      key={`${student.name}-${student.points}-${index}`}
                      className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 min-w-[150px] border border-white/10 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                          {student.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-white font-medium text-sm truncate">{student.name}</p>
                      </div>
                      <p className="text-white/70 text-xs">{student.points.toLocaleString()} pts</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaffLeaderboardDashboard() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const houseConfig = useMemo(() => getHouseConfigRecord(schoolHouses), [schoolHouses])

  useEffect(() => {
    if (!userId || !currentSchoolId) return

    const loadData = async () => {
      setDataLoading(true)
      setDataError(null)

      const { data, error } = await supabase
        .from('house_standings_cache')
        .select('house,total_points,computed_at')
        .order('total_points', { ascending: false })

      if (error) {
        setDataError(error.message)
        setLeaderboard([])
      } else {
        const mapped = (data ?? []).map((row) => ({
          house: String(row.house ?? 'Unknown'),
          totalPoints: Number(row.total_points ?? 0),
        }))
        setLeaderboard(mapped)
        const computedAt = (data ?? [])[0]?.computed_at ?? null
        setLastUpdated(computedAt ? String(computedAt) : null)
      }
      setDataLoading(false)
    }

    loadData()
  }, [currentSchoolId, userId])

  const houses: HouseData[] = useMemo(() => {
    const totalPoints = leaderboard.reduce((sum, item) => sum + (item.totalPoints ?? 0), 0)

    return leaderboard.map((entry) => {
      const canonicalName = canonicalHouseName(entry.house, schoolHouses)
      const config = houseConfig[canonicalName] ?? {
        color: '#1a1a1a',
        gradient: 'linear-gradient(135deg, #2a2a4e 0%, #1a1a1a 100%)',
        logo: '/crest.png',
      }

      return {
        name: canonicalName,
        points: entry.totalPoints,
        color: config.color,
        gradient: config.gradient,
        logo: config.logo,
        percentage: totalPoints > 0 ? (entry.totalPoints / totalPoints) * 100 : 0,
      }
    })
  }, [houseConfig, leaderboard, schoolHouses])

  const topHouse = houses[0]
  const otherHouses = houses.slice(1)
  const isStale = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 1000 : false

  if (dataLoading || housesLoading) {
    return (
      <CrestLoader label="Loading dashboard..." />
    )
  }

  if (dataError) {
    return (
      <div className="regal-card rounded-2xl p-6">
        <div className="flex items-center gap-3 text-[#910000]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium">{dataError}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          House Standings
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Current academic year rankings</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#1a1a1a]/50">
          <span>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'unavailable'}</span>
          {isStale ? (
            <span
              className="inline-flex items-center rounded-full bg-[#B8860B]/10 px-2 py-0.5 text-[#B8860B]"
              data-testid="standings-stale-badge"
            >
              Data delayed
            </span>
          ) : null}
        </div>
      </div>

      {/* House Podium */}
      {houses.length === 0 ? (
        <div className="regal-card rounded-2xl p-8 text-center" data-testid="dashboard-standings-empty">
          <p className="text-[#1a1a1a]/50">No points logged yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {topHouse ? (
            <div
              className="rounded-3xl overflow-hidden shadow-2xl relative"
              style={{ background: topHouse.gradient }}
            >
              <div className="absolute -top-6 right-6 text-[120px] font-black text-white/10">
                1
              </div>
              <div className="p-8 relative z-10">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm p-2 shadow-lg border border-white/10">
                      <img
                        src={topHouse.logo}
                        alt={topHouse.name}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-white/70 bg-white/10 border border-white/15 px-3 py-1 rounded-full mb-3">
                        <span className="text-white/50">Top House</span>
                      </div>
                      <h2 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                        {topHouse.name}
                      </h2>
                      <p className="text-white/60 text-sm font-medium">{topHouse.percentage.toFixed(1)}% of total points</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-5xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {topHouse.points.toLocaleString()}
                    </p>
                    <p className="text-white/50 text-sm font-medium">Total Points</p>
                  </div>
                </div>
                <div className="mt-6 h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${topHouse.percentage}%`,
                      background: 'linear-gradient(90deg, #B8860B 0%, #d4a017 50%, #B8860B 100%)',
                    }}
                  />
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-transparent via-[#B8860B]/60 to-transparent"></div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherHouses.map((house, index) => (
              <div
                key={house.name}
                className="rounded-2xl overflow-hidden shadow-xl relative"
                style={{ background: house.gradient }}
              >
                <div className="absolute top-4 right-4 text-4xl font-black text-white/10">
                  {index + 2}
                </div>
                <div className="p-5 relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm p-1.5 shadow-lg border border-white/10">
                      <img
                        src={house.logo}
                        alt={house.name}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                        {house.name}
                      </h3>
                      <p className="text-white/60 text-xs font-medium">{house.percentage.toFixed(1)}% of total points</p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-3xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {house.points.toLocaleString()}
                    </p>
                    <p className="text-white/50 text-xs font-medium">Points</p>
                  </div>
                  <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${house.percentage}%`,
                        background: 'linear-gradient(90deg, #B8860B 0%, #d4a017 50%, #B8860B 100%)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a4e] px-5 py-4 rounded-2xl">
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium text-white/60">Total Points Awarded</span>
              <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                {houses.reduce((sum, h) => sum + h.points, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { role, loading } = useUserRole()

  if (loading) {
    return <CrestLoader label="Loading dashboard..." />
  }

  if (role === 'admin') {
    return <AdminOverviewDashboard />
  }

  return <StaffLeaderboardDashboard />
}
