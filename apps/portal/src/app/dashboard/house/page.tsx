'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../providers'
import { supabase } from '../../../lib/supabaseClient'
import CrestLoader from '../../../components/CrestLoader'
import { canonicalHouseName, getHouseConfigRecord } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface StudentProfile {
  name: string
  grade: number
  section: string
  house: string
}

interface HouseStanding {
  house: string
  total_points: number
}

export default function MyHousePage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [standings, setStandings] = useState<HouseStanding[]>([])
  const [loading, setLoading] = useState(true)
  const houseConfig = useMemo(() => getHouseConfigRecord(schoolHouses), [schoolHouses])

  useEffect(() => {
    if (!userId) return
    if (!currentSchoolId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('linked_student_id')
        .eq('id', userId)
        .eq('school_id', currentSchoolId)
        .maybeSingle()

      if (error || !data?.linked_student_id) {
        setProfile(null)
      } else {
        const { data: student } = await supabase
          .from('students')
          .select('student_name, grade, section, house')
          .eq('student_id', data.linked_student_id)
          .eq('school_id', currentSchoolId)
          .maybeSingle()

        const name = String(student?.student_name ?? '').trim()
        const grade = Number(student?.grade ?? 0)
        const section = String(student?.section ?? '')
        const house = String(student?.house ?? '')

        if (!name || !house) {
          setProfile(null)
        } else {
          setProfile({ name, grade, section, house })
        }
      }

      const { data: standingsData } = await supabase
        .from('house_standings_cache')
        .select('house,total_points')
        .eq('school_id', currentSchoolId)
        .order('total_points', { ascending: false })

      setStandings((standingsData || []) as HouseStanding[])
      setLoading(false)
    }

    loadData()
  }, [currentSchoolId, userId])

  const canonical = profile ? canonicalHouseName(profile.house, schoolHouses) : ''
  const houseInfo = houseConfig[canonical]

  const rankInfo = useMemo(() => {
    if (!canonical) return { rank: null, totalPoints: 0, percentage: 0 }
      const ranked = standings.map((item) => ({
      house: canonicalHouseName(String(item.house ?? ''), schoolHouses),
      points: Number(item.total_points ?? 0),
    }))
    const sorted = ranked
      .filter((item) => item.house)
      .sort((a, b) => b.points - a.points)
    const total = sorted.reduce((sum, item) => sum + item.points, 0)
    const index = sorted.findIndex((item) => item.house === canonical)
    const points = sorted[index]?.points ?? 0
    return {
      rank: index >= 0 ? index + 1 : null,
      totalPoints: points,
      percentage: total > 0 ? (points / total) * 100 : 0,
    }
  }, [canonical, schoolHouses, standings])

  if (loading || housesLoading) {
    return (
      <CrestLoader label="Loading your house..." />
    )
  }

  if (!profile || !houseInfo) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#B8860B]/10 text-center">
        <p className="text-[#1a1a1a]/70 font-medium">We couldn't find your house yet.</p>
        <p className="text-sm text-[#1a1a1a]/45 mt-2">Please contact the office to link your account.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          My House
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">House standing and contribution snapshot.</p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-xl relative" style={{ background: houseInfo.gradient }}>
        <div className="absolute top-8 right-10 w-40 h-40 opacity-[0.06]">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path fill="white" d="M100,10 L120,80 L190,80 L130,120 L150,190 L100,150 L50,190 L70,120 L10,80 L80,80 Z" />
          </svg>
        </div>

        <div className="p-6 relative z-10">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                <img src={houseInfo.logo} alt={canonical} className="w-12 h-12 object-contain" />
              </div>
              <div>
                <p className="text-white/70 text-xs uppercase tracking-[0.2em]">My House</p>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  {canonical}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/70">House Rank</p>
              <p className="text-3xl font-bold text-white">#{rankInfo.rank ?? '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4 border border-white/15">
              <p className="text-xs uppercase tracking-wider text-white/60">Total Points</p>
              <p className="text-2xl font-bold text-white mt-2">{rankInfo.totalPoints.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/15">
              <p className="text-xs uppercase tracking-wider text-white/60">Share of Points</p>
              <p className="text-2xl font-bold text-white mt-2">{rankInfo.percentage.toFixed(1)}%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/15">
              <p className="text-xs uppercase tracking-wider text-white/60">My Class</p>
              <p className="text-2xl font-bold text-white mt-2">{profile.grade}{profile.section}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
