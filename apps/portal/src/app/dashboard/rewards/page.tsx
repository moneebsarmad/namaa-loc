'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../providers'
import { supabase } from '@/lib/supabaseClient'
import { Tables } from '@/lib/supabase/tables'
import CrestLoader from '@/components/CrestLoader'
import { useSessionStorageState } from '@/hooks/useSessionStorageState'
import { getHouseLogoMap, getHouseNames } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface Student {
  name: string
  grade: number
  section: string
  house: string
  gender: string
  totalPoints: number
  categoryPoints: Record<string, number>
  weeklyPoints: Record<string, number>
  monthlyPoints: Record<string, number>
}

interface MeritEntry {
  studentName: string
  points: number
  category: string
  timestamp: string
  house: string
  grade: number
  section: string
}

interface HallEntry {
  name: string
  grade: number
  section: string
  gender: string
  totalPoints: number
}

interface BadgeLeader {
  quarter: string
  category: string
  gender: string
  studentName: string
  grade: number
  section?: string
  totalPoints: number
}

interface BadgeWinnerEntry {
  name: string
  grade: number
  categoryPoints: Record<string, number>
}

interface ApproachingRow {
  tier: string
  tier_points: number
  student_name: string
  grade: number
  section: string
  house: string
  total_points: number
  points_needed: number
}

interface ConsistencyEntry {
  studentName: string
  grade: number
  section: string
}

interface RisingStarEntry {
  studentName: string
  grade: number
  section: string
  lastMonthPts: number
  currentMonthPts: number
  percentIncrease: number
}

interface HouseMvpEntry {
  house: string
  studentName: string
  points: number
}

interface GradeChampionEntry {
  grade: number
  section: string
  points: number
}

// Hall of Fame tiers
const hallOfFameTiers = [
  { name: 'Century Club', points: 100, icon: '💯', color: 'from-[#6b4a1a] to-[#b08a2e]', view: 'century_club' },
  { name: 'Badr Club', points: 300, icon: '🌙', color: 'from-[#23523b] to-[#3a7b59]', view: 'badr_club' },
  { name: 'Fath Club', points: 700, icon: '🏆', color: 'from-[#1f2a44] to-[#3b537a]', view: 'fath_club' },
]

// Quarterly badges
const quarterlyBadges = [
  { name: 'The Honour Guard', category: 'Respect', icon: '🛡️', description: 'Most points in Respect category' },
  { name: 'The Keeper', category: 'Responsibility', icon: '🔑', description: 'Most points in Responsibility category' },
  { name: 'The Light Bearer', category: 'Righteousness', icon: '🕯️', description: 'Most points in Righteousness category' },
]

const quarterOptions = [
  { id: 'q1', label: 'Q1 (Jan 6 – Mar 6)' },
  { id: 'q2', label: 'Q2 (Mar 9 – May 21)' },
] as const
const defaultQuarter = (() => {
  const today = new Date()
  const year = today.getFullYear()
  const q1Start = new Date(year, 0, 6)
  const q1End = new Date(year, 2, 6, 23, 59, 59, 999)
  const q2Start = new Date(year, 2, 9)
  const q2End = new Date(year, 4, 21, 23, 59, 59, 999)
  if (today >= q1Start && today <= q1End) return 'q1'
  if (today >= q2Start && today <= q2End) return 'q2'
  return 'q2'
})()

// Helper function to calculate ISO week key from a date
function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getQuarterRange(quarter: 'q1' | 'q2', year = new Date().getFullYear()) {
  if (quarter === 'q1') {
    return {
      start: new Date(year, 0, 6),
      end: new Date(year, 2, 6, 23, 59, 59, 999),
    }
  }
  return {
    start: new Date(year, 2, 9),
    end: new Date(year, 4, 21, 23, 59, 59, 999),
  }
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase()
}

function isMissingRelation(error: { message?: string | null } | null) {
  const message = error?.message || ''
  return message.includes('does not exist') || message.includes('Could not find the table')
}

function buildStudentKey(name: string, grade: number, section: string): string {
  return `${normalizeValue(name)}|${grade}|${normalizeValue(section || '')}`
}

function buildStudentKeyNoSection(name: string, grade: number): string {
  return `${normalizeValue(name)}|${grade}`
}

function getRowValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in row) return row[key]
  }
  const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[key.toLowerCase()] = key
    return acc
  }, {})
  for (const key of keys) {
    const normalized = normalizedKeys[key.toLowerCase()]
    if (normalized) return row[normalized]
  }
  return undefined
}

export default function RewardsPage() {
  const { user } = useAuth()
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses } = useSchoolHouses(Boolean(currentSchoolId))
  const [students, setStudents] = useState<Student[]>([])
  const [meritEntries, setMeritEntries] = useState<MeritEntry[]>([])
  const [hallOfFameEntries, setHallOfFameEntries] = useState<Record<string, HallEntry[]>>({})
  const [badgeLeaders, setBadgeLeaders] = useState<BadgeLeader[]>([])
  const [approachingRows, setApproachingRows] = useState<ApproachingRow[]>([])
  const [consistencyLeaders, setConsistencyLeaders] = useState<ConsistencyEntry[]>([])
  const [risingStarLeaders, setRisingStarLeaders] = useState<RisingStarEntry[]>([])
  const [houseMvpLeaders, setHouseMvpLeaders] = useState<HouseMvpEntry[]>([])
  const [gradeChampionLeaders, setGradeChampionLeaders] = useState<GradeChampionEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useSessionStorageState<'hall-of-fame' | 'badges' | 'monthly' | 'approaching'>(
    'portal:rewards:selectedTab',
    'hall-of-fame'
  )
  const [selectedQuarter, setSelectedQuarter] = useSessionStorageState<'q1' | 'q2'>(
    'portal:rewards:selectedQuarter',
    defaultQuarter
  )
  const houseLogos = useMemo(() => getHouseLogoMap(schoolHouses), [schoolHouses])
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])

  useEffect(() => {
    if (!currentSchoolId) {
      setIsLoading(false)
      return
    }
    fetchData()
  }, [currentSchoolId])

  useEffect(() => {
    if (!currentSchoolId) return
    fetchConsistencyCrown()
    fetchRisingStars()
    fetchHouseMvps()
    fetchGradeChampions()
    fetchApproachingMilestones()
  }, [currentSchoolId])

  useEffect(() => {
    fetchBadgeLeaders()
  }, [selectedQuarter])

  useEffect(() => {
    if (!currentSchoolId) return
    const channel = supabase
      .channel('rewards-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: Tables.students }, () => {
        fetchData()
        fetchBadgeLeaders()
        fetchConsistencyCrown()
        fetchRisingStars()
        fetchHouseMvps()
        fetchGradeChampions()
        fetchApproachingMilestones()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: Tables.meritLog }, () => {
        fetchData()
        fetchBadgeLeaders()
        fetchConsistencyCrown()
        fetchRisingStars()
        fetchHouseMvps()
        fetchGradeChampions()
        fetchApproachingMilestones()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchoolId])

  const getThreeRCategory = (value: string) => {
    const raw = (value || '').toLowerCase()
    if (raw.includes('respect')) return 'Respect'
    if (raw.includes('responsibility')) return 'Responsibility'
    if (raw.includes('righteousness')) return 'Righteousness'
    return ''
  }

  const fetchData = async () => {
    if (!currentSchoolId) {
      setStudents([])
      setMeritEntries([])
      setHallOfFameEntries({})
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const getRowValue = (row: Record<string, unknown>, keys: string[]) => {
        for (const key of keys) {
          if (key in row) return row[key]
        }
        const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
          acc[key.toLowerCase()] = key
          return acc
        }, {})
        for (const key of keys) {
          const normalized = normalizedKeys[key.toLowerCase()]
          if (normalized) return row[normalized]
        }
        return undefined
      }

      const fetchHallOfFame = async () => {
        const results = await Promise.all(
          hallOfFameTiers.map(async (tier) => {
            const { data, error } = await supabase.from(tier.view).select('*').eq('school_id', currentSchoolId)
            if (error) {
              console.error(`Error fetching ${tier.view}:`, error)
              return { view: tier.view, entries: [] as HallEntry[] }
            }
            const entries = (data || [])
              .map((row: Record<string, unknown>) => {
                const nameRaw = getRowValue(row, ['student_name', 'student', 'name', 'full_name'])
                const gradeRaw = getRowValue(row, ['grade'])
                const sectionRaw = getRowValue(row, ['section'])
                const genderRaw = getRowValue(row, ['gender'])
                const pointsRaw = getRowValue(row, ['total_points', 'points', 'total'])
                const name = String(nameRaw ?? '').trim()
                if (!name) return null
                return {
                  name,
                  grade: Number(gradeRaw) || 0,
                  section: String(sectionRaw ?? ''),
                  gender: String(genderRaw ?? ''),
                  totalPoints: Number(pointsRaw) || 0,
                }
              })
              .filter(Boolean) as HallEntry[]
            return { view: tier.view, entries }
          })
        )

        const next: Record<string, HallEntry[]> = {}
        results.forEach((result) => {
          next[result.view] = result.entries
        })
        setHallOfFameEntries(next)
      }

      // Fetch students from all grade tables
      const studentMap: Record<string, Student> = {}
      const { data: studentData } = await supabase.from(Tables.students).select('*').eq('school_id', currentSchoolId)
      ;(studentData || []).forEach((s) => {
        const name = s.student_name || ''
        const key = `${name.toLowerCase()}|${s.grade || 0}|${(s.section || '').toLowerCase()}`
        if (!studentMap[key]) {
          studentMap[key] = {
            name,
            grade: s.grade || 0,
            section: s.section || '',
            house: s.house || '',
            gender: s.gender || '',
            totalPoints: 0,
            categoryPoints: {},
            weeklyPoints: {},
            monthlyPoints: {},
          }
        }
      })

      // Fetch merit entries
      const { data: meritData } = await supabase
        .from(Tables.meritLog)
        .select('*')
        .eq('school_id', currentSchoolId)
        .order('timestamp', { ascending: false })

      if (meritData) {
        const entries: MeritEntry[] = meritData.map((m) => ({
          studentName: m.student_name || '',
          points: m.points || 0,
          category: getThreeRCategory(m.r || ''),
          timestamp: m.timestamp || '',
          house: m.house || '',
          grade: m.grade || 0,
          section: m.section || '',
        }))
        setMeritEntries(entries)

        // Calculate points per student
        entries.forEach((e) => {
          const key = `${e.studentName.toLowerCase()}|${e.grade}|${e.section.toLowerCase()}`
          if (!studentMap[key]) {
            studentMap[key] = {
              name: e.studentName,
              grade: e.grade,
              section: e.section,
              house: e.house,
              gender: '',
              totalPoints: 0,
              categoryPoints: {},
              weeklyPoints: {},
              monthlyPoints: {},
            }
          }

          studentMap[key].totalPoints += e.points

          // Category points
          if (e.category) {
            studentMap[key].categoryPoints[e.category] =
              (studentMap[key].categoryPoints[e.category] || 0) + e.points
          }

          // Weekly points (get week number from timestamp)
          if (e.timestamp) {
            const date = new Date(e.timestamp)
            const weekKey = getWeekKey(date)
            studentMap[key].weeklyPoints[weekKey] =
              (studentMap[key].weeklyPoints[weekKey] || 0) + e.points

            // Monthly points
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            studentMap[key].monthlyPoints[monthKey] =
              (studentMap[key].monthlyPoints[monthKey] || 0) + e.points
          }
        })
      }

      setStudents(Object.values(studentMap))
      await fetchHallOfFame()
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBadgeLeaders = async () => {
    try {
      const { data, error } = await supabase
        .from('quarterly_badge_leaders')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        if (isMissingRelation(error)) {
          setBadgeLeaders([])
          return
        }
        console.error('Error fetching quarterly badge leaders:', error)
        setBadgeLeaders([])
        return
      }

      const normalizeQuarter = (value: string) => {
        const raw = value.toLowerCase().replace(/\s+/g, '')
        if (raw.startsWith('q1')) return 'q1'
        if (raw.startsWith('q2')) return 'q2'
        return raw
      }

      const leaders: BadgeLeader[] = (data || [])
        .map((row: Record<string, unknown>) => ({
          quarter: String(row.quarter ?? ''),
          category: String(row.category ?? ''),
          gender: String(row.gender ?? ''),
          studentName: String(row.student_name ?? row.studentName ?? ''),
          grade: Number(row.grade ?? 0),
          section: String(row.section ?? ''),
          totalPoints: Number(row.total_points ?? row.totalPoints ?? 0),
          rank: Number(row.rank ?? 0),
        }))
        .filter((row) => normalizeQuarter(row.quarter) === selectedQuarter && row.rank === 1)
        .map(({ quarter, category, gender, studentName, grade, section, totalPoints }) => ({
          quarter,
          category,
          gender,
          studentName,
          grade,
          section,
          totalPoints,
        }))

      setBadgeLeaders(leaders)
    } catch (error) {
      console.error('Error fetching quarterly badge leaders:', error)
      setBadgeLeaders([])
    }
  }

  const fetchApproachingMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('approaching_milestones')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        console.error('Error fetching approaching milestones:', error)
        setApproachingRows([])
        return
      }

      const mapped = (data || []).map((row: Record<string, unknown>) => {
        const nextMilestone = Number(row.next_milestone ?? row.tier_points ?? row.tierPoints ?? 0)
        const tierName = nextMilestone === 100
          ? 'Century Club'
          : nextMilestone === 300
            ? 'Badr Club'
            : nextMilestone === 700
              ? 'Fath Club'
              : 'Milestone'

        return {
          tier: String(row.tier ?? tierName),
          tier_points: Number(row.tier_points ?? row.tierPoints ?? nextMilestone),
          student_name: String(row.student_name ?? row.studentName ?? ''),
          grade: Number(row.grade ?? 0),
          section: String(row.section ?? ''),
          house: String(row.house ?? ''),
          total_points: Number(row.total_points ?? row.totalPoints ?? 0),
          points_needed: Number(row.points_needed ?? row.pointsRemaining ?? row.points_remaining ?? 0),
        } satisfies ApproachingRow
      })

      setApproachingRows(mapped)
    } catch (error) {
      console.error('Error fetching approaching milestones:', error)
      setApproachingRows([])
    }
  }

  const getCurrentMonthStart = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }

  const fetchConsistencyCrown = async () => {
    try {
      const { data, error } = await supabase
        .from('consistency_crown')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        if (isMissingRelation(error)) {
          setConsistencyLeaders([])
          return
        }
        console.error('Error fetching consistency crown:', error)
        setConsistencyLeaders([])
        return
      }

      const entries: ConsistencyEntry[] = (data || []).map((row: Record<string, unknown>) => ({
        studentName: String(row.student_name ?? row.studentName ?? ''),
        grade: Number(row.grade ?? 0),
        section: String(row.section ?? ''),
      }))
      setConsistencyLeaders(entries)
    } catch (error) {
      console.error('Error fetching consistency crown:', error)
      setConsistencyLeaders([])
    }
  }

  const fetchRisingStars = async () => {
    try {
      const { data, error } = await supabase
        .from('rising_star')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        if (isMissingRelation(error)) {
          setRisingStarLeaders([])
          return
        }
        console.error('Error fetching rising stars:', error)
        setRisingStarLeaders([])
        return
      }

      const entries: RisingStarEntry[] = (data || []).map((row: Record<string, unknown>) => ({
        studentName: String(row.student_name ?? row.studentName ?? ''),
        grade: Number(row.grade ?? 0),
        section: String(row.section ?? ''),
        lastMonthPts: Number(row.last_points ?? row.lastMonthPts ?? 0),
        currentMonthPts: Number(row.current_points ?? row.currentMonthPts ?? 0),
        percentIncrease: Number(row.percent_increase ?? row.percentIncrease ?? 0),
      }))
      setRisingStarLeaders(entries)
    } catch (error) {
      console.error('Error fetching rising stars:', error)
      setRisingStarLeaders([])
    }
  }

  const fetchHouseMvps = async () => {
    try {
      const { data, error } = await supabase
        .from('house_mvp_monthly')
        .select('*')
        .eq('school_id', currentSchoolId)
        .eq('month_start', getCurrentMonthStart())

      if (error) {
        if (isMissingRelation(error)) {
          setHouseMvpLeaders([])
          return
        }
        console.error('Error fetching house MVPs:', error)
        setHouseMvpLeaders([])
        return
      }

      const entries: HouseMvpEntry[] = (data || [])
        .filter((row: Record<string, unknown>) => Number(row.rank ?? 0) === 1)
        .map((row: Record<string, unknown>) => {
          const houseRaw = getRowValue(row, ['house', 'house_name', 'houseName'])
          const studentRaw = getRowValue(row, ['student_name', 'student', 'name', 'full_name', 'studentName'])
          const pointsRaw = getRowValue(row, ['total_points', 'points', 'total', 'totalPoints'])
          return {
            house: String(houseRaw ?? ''),
            studentName: String(studentRaw ?? ''),
            points: Number(pointsRaw ?? 0),
          }
        })
      setHouseMvpLeaders(entries)
    } catch (error) {
      console.error('Error fetching house MVPs:', error)
      setHouseMvpLeaders([])
    }
  }

  const fetchGradeChampions = async () => {
    try {
      const { data, error } = await supabase
        .from('grade_champions')
        .select('*')
        .eq('school_id', currentSchoolId)

      if (error) {
        console.error('Error fetching grade champions:', error)
        setGradeChampionLeaders([])
        return
      }

      const entries: GradeChampionEntry[] = (data || []).map((row: Record<string, unknown>) => ({
        grade: Number(row.grade ?? 0),
        section: String(row.section ?? ''),
        points: Number(row.total_points ?? row.points ?? 0),
      }))
      setGradeChampionLeaders(entries)
    } catch (error) {
      console.error('Error fetching grade champions:', error)
      setGradeChampionLeaders([])
    }
  }


  const studentHouseMap = useMemo(() => {
    const map = new Map<string, string>()
    students.forEach((s) => {
      const key = buildStudentKey(s.name, s.grade, s.section)
      map.set(key, s.house)
    })
    return map
  }, [students])

  const studentMetaMap = useMemo(() => {
    const map = new Map<string, { gender: string; house: string }>()
    students.forEach((student) => {
      const key = buildStudentKey(student.name, student.grade, student.section)
      map.set(key, { gender: student.gender || '', house: student.house || '' })
      const noSectionKey = buildStudentKeyNoSection(student.name, student.grade)
      if (!map.has(noSectionKey)) {
        map.set(noSectionKey, { gender: student.gender || '', house: student.house || '' })
      }
    })
    return map
  }, [students])

  const resolveStudentMeta = (name: string, grade: number, section: string) => {
    const key = buildStudentKey(name, grade, section)
    const fallbackKey = buildStudentKeyNoSection(name, grade)
    return studentMetaMap.get(key) || studentMetaMap.get(fallbackKey)
  }

  const fallbackBadgeLeaders = useMemo(() => {
    if (!meritEntries.length) return [] as BadgeLeader[]
    const { start, end } = getQuarterRange(selectedQuarter)
    const totals = new Map<string, BadgeLeader>()

    meritEntries.forEach((entry) => {
      if (!entry.category) return
      if (!entry.timestamp) return
      const date = new Date(entry.timestamp)
      if (Number.isNaN(date.getTime())) return
      if (date < start || date > end) return

      const key = `${entry.category}|${buildStudentKey(entry.studentName, entry.grade, entry.section)}`
      const meta = resolveStudentMeta(entry.studentName, entry.grade, entry.section)
      const current = totals.get(key)
      if (!current) {
        totals.set(key, {
          quarter: selectedQuarter,
          category: entry.category,
          gender: meta?.gender || '',
          studentName: entry.studentName,
          grade: entry.grade,
          section: entry.section,
          totalPoints: entry.points,
        })
      } else {
        current.totalPoints += entry.points
      }
    })

    return [...totals.values()]
  }, [meritEntries, selectedQuarter, studentMetaMap])

  const resolvedBadgeLeaders = useMemo(() => {
    const source = badgeLeaders.length ? badgeLeaders : fallbackBadgeLeaders
    return source.map((leader) => {
      const meta = resolveStudentMeta(leader.studentName, leader.grade, leader.section || '')
      return {
        ...leader,
        gender: leader.gender || meta?.gender || '',
      }
    })
  }, [badgeLeaders, fallbackBadgeLeaders, studentMetaMap])

  // Hall of Fame - students who reached milestones
  const hallOfFame = useMemo(() => {
    return hallOfFameTiers.map((tier) => {
      const entries = (hallOfFameEntries[tier.view] || []).slice().sort((a, b) => b.totalPoints - a.totalPoints)
      const resolvedEntries = entries.map((entry) => {
        const meta = resolveStudentMeta(entry.name, entry.grade, entry.section)
        return {
          ...entry,
          gender: entry.gender || meta?.gender || '',
        }
      })
      const males = resolvedEntries.filter((s) => s.gender?.toLowerCase() === 'm' || s.gender?.toLowerCase() === 'male')
      const females = resolvedEntries.filter((s) => s.gender?.toLowerCase() === 'f' || s.gender?.toLowerCase() === 'female')

      return { ...tier, males, females, total: resolvedEntries.length }
    })
  }, [hallOfFameEntries, studentMetaMap])

  // Quarterly Badges - top in each category
  const badgeWinners = useMemo(() => {
    const toEntry = (leader?: BadgeLeader): BadgeWinnerEntry | null => {
      if (!leader) return null
      return {
        name: leader.studentName,
        grade: leader.grade,
        categoryPoints: {
          [leader.category]: leader.totalPoints,
        },
      }
    }

    return quarterlyBadges.map((badge) => {
      const categoryLeaders = resolvedBadgeLeaders.filter((leader) => leader.category === badge.category)
      const topMale = categoryLeaders.find((leader) => ['m', 'male'].includes(leader.gender.toLowerCase()))
      const topFemale = categoryLeaders.find((leader) => ['f', 'female'].includes(leader.gender.toLowerCase()))

      return {
        ...badge,
        topMale: toEntry(topMale),
        topFemale: toEntry(topFemale),
      }
    })
  }, [resolvedBadgeLeaders])

  const fallbackConsistencyLeaders = useMemo(() => {
    if (!students.length) return [] as ConsistencyEntry[]
    const weekKeys: string[] = []
    const date = new Date()
    for (let i = 0; i < 3; i += 1) {
      weekKeys.push(getWeekKey(date))
      date.setDate(date.getDate() - 7)
    }

    return students
      .filter((student) => weekKeys.every((key) => (student.weeklyPoints[key] || 0) >= 20))
      .map((student) => ({
        studentName: student.name,
        grade: student.grade,
        section: student.section,
      }))
  }, [students])

  // Consistency Crown - 20+ points in each of the past 3 consecutive weeks
  const consistencyCrown = useMemo(() => {
    const source = consistencyLeaders.length ? consistencyLeaders : fallbackConsistencyLeaders
    return source.map((entry) => {
      const key = buildStudentKey(entry.studentName, entry.grade, entry.section)
      return {
        name: entry.studentName,
        grade: entry.grade,
        house: studentHouseMap.get(key) || '',
      }
    })
  }, [consistencyLeaders, fallbackConsistencyLeaders, studentHouseMap])

  const fallbackRisingStars = useMemo(() => {
    if (!students.length) return [] as RisingStarEntry[]
    const now = new Date()
    const currentKey = getMonthKey(now)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastKey = getMonthKey(lastMonth)
    const entries: RisingStarEntry[] = []

    students.forEach((student) => {
      const lastPoints = student.monthlyPoints[lastKey] || 0
      const currentPoints = student.monthlyPoints[currentKey] || 0
      const diff = currentPoints - lastPoints
      if (lastPoints < 30 || diff < 20) return
      const percentIncrease = (diff / lastPoints) * 100
      entries.push({
        studentName: student.name,
        grade: student.grade,
        section: student.section,
        lastMonthPts: lastPoints,
        currentMonthPts: currentPoints,
        percentIncrease,
      })
    })

    return entries
  }, [students])

  // Rising Star - highest % increase month-over-month
  const risingStars = useMemo(() => {
    const source = risingStarLeaders.length ? risingStarLeaders : fallbackRisingStars
    return source
      .map((entry) => {
        const key = buildStudentKey(entry.studentName, entry.grade, entry.section)
        return {
          name: entry.studentName,
          grade: entry.grade,
          section: entry.section,
          house: studentHouseMap.get(key) || '',
          percentIncrease: entry.percentIncrease,
          lastMonthPts: entry.lastMonthPts,
          currentMonthPts: entry.currentMonthPts,
        }
      })
      .sort((a, b) => b.percentIncrease - a.percentIncrease)
  }, [risingStarLeaders, fallbackRisingStars, studentHouseMap])

  const fallbackHouseMvps = useMemo(() => {
    if (!meritEntries.length) return [] as HouseMvpEntry[]
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const totals = new Map<string, HouseMvpEntry>()

    meritEntries.forEach((entry) => {
      if (!entry.house) return
      if (!entry.timestamp) return
      const date = new Date(entry.timestamp)
      if (Number.isNaN(date.getTime())) return
      if (date < monthStart || date > monthEnd) return

      const key = `${entry.house}|${buildStudentKey(entry.studentName, entry.grade, entry.section)}`
      const current = totals.get(key)
      if (!current) {
        totals.set(key, { house: entry.house, studentName: entry.studentName, points: entry.points })
      } else {
        current.points += entry.points
      }
    })

    const byHouse = new Map<string, HouseMvpEntry>()
    totals.forEach((entry) => {
      const current = byHouse.get(entry.house)
      if (!current || entry.points > current.points) {
        byHouse.set(entry.house, entry)
      }
    })
    return [...byHouse.values()]
  }, [meritEntries])

  // House MVPs - top student per house this month
  const houseMVPs = useMemo(() => {
    const source = houseMvpLeaders.length ? houseMvpLeaders : fallbackHouseMvps
    const leaderMap = new Map(source.map((entry) => [entry.house, entry]))
    return houseNames.map((house) => {
      const leader = leaderMap.get(house) || null
      return {
        house,
        mvp: leader ? { name: leader.studentName } : null,
        points: leader?.points || 0,
      }
    })
  }, [fallbackHouseMvps, houseMvpLeaders, houseNames])

  const fallbackGradeChampions = useMemo(() => {
    if (!meritEntries.length) return [] as GradeChampionEntry[]
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const totals = new Map<string, GradeChampionEntry>()

    meritEntries.forEach((entry) => {
      if (!entry.grade || !entry.section) return
      if (!entry.timestamp) return
      const date = new Date(entry.timestamp)
      if (Number.isNaN(date.getTime())) return
      if (date < monthStart || date > monthEnd) return

      const key = `${entry.grade}|${entry.section}`
      const current = totals.get(key)
      if (!current) {
        totals.set(key, { grade: entry.grade, section: entry.section, points: entry.points })
      } else {
        current.points += entry.points
      }
    })

    const byGrade = new Map<number, GradeChampionEntry>()
    totals.forEach((entry) => {
      const current = byGrade.get(entry.grade)
      if (!current || entry.points > current.points) {
        byGrade.set(entry.grade, entry)
      }
    })
    return [...byGrade.values()]
  }, [meritEntries])

  // Grade Champions - top section per grade this month
  const gradeChampions = useMemo(() => {
    const grades = [6, 7, 8, 9, 10, 11, 12]
    const source = gradeChampionLeaders.length ? gradeChampionLeaders : fallbackGradeChampions
    const leaderMap = new Map(source.map((entry) => [entry.grade, entry]))
    return grades.map((grade) => {
      const leader = leaderMap.get(grade) || null
      return {
        grade,
        champion: leader ? { section: leader.section } : null,
        points: leader?.points || 0,
      }
    })
  }, [gradeChampionLeaders, fallbackGradeChampions])

  // Approaching Milestones
  const approachingMilestones = useMemo(() => {
    const grouped = new Map<string, ApproachingRow[]>()
    approachingRows.forEach((row) => {
      const key = String(row.tier)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    })

    return hallOfFameTiers.map((tier) => {
      const rows = grouped.get(tier.name) || []
      const students = rows
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 10)
        .map((row) => ({
          name: row.student_name,
          grade: row.grade,
          house: row.house,
          totalPoints: row.total_points,
          pointsNeeded: row.points_needed,
        }))
      return { ...tier, students }
    })
  }, [approachingRows])

  if (isLoading) {
    return <CrestLoader label="Loading rewards data..." />
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Student Rewards
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Recognition & incentive tracking</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'hall-of-fame', label: 'Hall of Fame', icon: '🏆' },
          { id: 'badges', label: 'Quarterly Badges', icon: '🎖️' },
          { id: 'monthly', label: 'Monthly Rewards', icon: '⭐' },
          { id: 'approaching', label: 'Approaching', icon: '🎯' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              selectedTab === tab.id
                ? 'bg-gradient-to-r from-[#2D5016] to-[#3d6b1e] text-white shadow-lg'
                : 'bg-white text-[#1a1a1a]/60 hover:bg-[#1a1a1a]/5 border border-[#B8860B]/20'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hall of Fame Tab */}
      {selectedTab === 'hall-of-fame' && (
        <div className="space-y-6">
          {hallOfFame.map((tier) => (
            <div key={tier.name} className="regal-card rounded-2xl overflow-hidden">
              <div className={`bg-gradient-to-r ${tier.color} p-6`}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{tier.icon}</span>
                  <div>
                    <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {tier.name}
                    </h3>
                    <p className="text-white/70">Students with {tier.points}+ individual points</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-3xl font-bold text-white">{tier.total}</p>
                    <p className="text-white/70 text-sm">Total Members</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Males */}
                  <div>
                    <h4 className="text-sm font-semibold text-[#1a1a1a]/40 tracking-wider mb-4">Male Recipients ({tier.males.length})</h4>
                    {tier.males.length === 0 ? (
                      <p className="text-[#1a1a1a]/30 text-sm">No male students have reached this milestone yet</p>
                    ) : (
                      <div className="space-y-2">
                        {tier.males.slice(0, 5).map((s, i) => (
                          <div key={`${s.name}-${s.grade}-${s.section}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f3ef]">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-[#1a1a1a]">{s.name}</p>
                              <p className="text-xs text-[#1a1a1a]/40">Grade {s.grade} • {s.section}</p>
                            </div>
                            <span className="font-bold text-[#2D5016]">{s.totalPoints} pts</span>
                          </div>
                        ))}
                        {tier.males.length > 5 && (
                          <p className="text-sm text-[#1a1a1a]/40 text-center">+{tier.males.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Females */}
                  <div>
                    <h4 className="text-sm font-semibold text-[#1a1a1a]/40 tracking-wider mb-4">Female Recipients ({tier.females.length})</h4>
                    {tier.females.length === 0 ? (
                      <p className="text-[#1a1a1a]/30 text-sm">No female students have reached this milestone yet</p>
                    ) : (
                      <div className="space-y-2">
                        {tier.females.slice(0, 5).map((s, i) => (
                          <div key={`${s.name}-${s.grade}-${s.section}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f3ef]">
                            <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-[#1a1a1a]">{s.name}</p>
                              <p className="text-xs text-[#1a1a1a]/40">Grade {s.grade} • {s.section}</p>
                            </div>
                            <span className="font-bold text-[#2D5016]">{s.totalPoints} pts</span>
                          </div>
                        ))}
                        {tier.females.length > 5 && (
                          <p className="text-sm text-[#1a1a1a]/40 text-center">+{tier.females.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quarterly Badges Tab */}
      {selectedTab === 'badges' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Quarterly Badges
              </h2>
              <p className="text-sm text-[#1a1a1a]/50">Select the quarter to view top students by category.</p>
            </div>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value as 'q1' | 'q2')}
              className="px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
            >
              {quarterOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {badgeWinners.map((badge) => (
              <div key={badge.name} className="regal-card rounded-2xl p-6">
                <div className="text-center mb-6">
                  <span className="text-5xl mb-3 block">{badge.icon}</span>
                  <h3 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                    {badge.name}
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/50 mt-1">{badge.description}</p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#B8860B]/10 text-[#8b6508]">
                    {badge.category}
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Top Male */}
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-600 tracking-wider mb-2">Top Male</p>
                    {badge.topMale ? (
                      <div>
                        <p className="font-bold text-[#1a1a1a]">{badge.topMale.name}</p>
                        <p className="text-sm text-[#1a1a1a]/50">Grade {badge.topMale.grade} • {badge.topMale.categoryPoints[badge.category]} pts</p>
                      </div>
                    ) : (
                      <p className="text-[#1a1a1a]/30 text-sm">No data yet</p>
                    )}
                  </div>
                  {/* Top Female */}
                  <div className="p-4 rounded-xl bg-pink-50 border border-pink-100">
                    <p className="text-xs font-semibold text-pink-600 tracking-wider mb-2">Top Female</p>
                    {badge.topFemale ? (
                      <div>
                        <p className="font-bold text-[#1a1a1a]">{badge.topFemale.name}</p>
                        <p className="text-sm text-[#1a1a1a]/50">Grade {badge.topFemale.grade} • {badge.topFemale.categoryPoints[badge.category]} pts</p>
                      </div>
                    ) : (
                      <p className="text-[#1a1a1a]/30 text-sm">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Rewards Tab */}
      {selectedTab === 'monthly' && (
        <div className="space-y-8">
          {/* Consistency Crown */}
          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">👑</span>
              <div>
                <h3 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Consistency Crown
                </h3>
                <p className="text-sm text-[#1a1a1a]/50">20+ points in each of the past 3 consecutive weeks</p>
              </div>
              <span className="ml-auto badge-gold px-3 py-1 rounded-lg text-sm">{consistencyCrown.length} eligible</span>
            </div>
            {consistencyCrown.length === 0 ? (
              <p className="text-[#1a1a1a]/30 text-center py-4">No students have met this criteria yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {consistencyCrown.slice(0, 6).map((s, index) => (
                  <div key={`${s.name}-${s.grade}-${s.house}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f3ef]">
                    <span className="text-2xl">👑</span>
                    <div>
                      <p className="font-medium text-[#1a1a1a]">{s.name}</p>
                      <p className="text-xs text-[#1a1a1a]/40">Grade {s.grade} • {s.house}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rising Star */}
          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🚀</span>
              <div>
                <h3 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Rising Star
                </h3>
                <p className="text-sm text-[#1a1a1a]/50">Highest % increase month-over-month (min 30 pts last month, +20 improvement)</p>
              </div>
            </div>
            {risingStars.length === 0 ? (
              <p className="text-[#1a1a1a]/30 text-center py-4">No students have met this criteria yet</p>
            ) : (
              <div className="space-y-3">
                {risingStars.slice(0, 5).map((s, i) => (
                  <div key={`${s.name}-${s.grade}-${i}`} className="flex items-center gap-4 p-4 rounded-xl bg-[#f5f3ef]">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      i === 0 ? 'bg-gradient-to-br from-[#ffd700] to-[#b8860b] text-white' : 'bg-white text-[#1a1a1a]/50'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-[#1a1a1a]">{s.name}</p>
                      <p className="text-xs text-[#1a1a1a]/40">Grade {s.grade} • {s.house}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+{s.percentIncrease.toFixed(0)}%</p>
                      <p className="text-xs text-[#1a1a1a]/40">{s.lastMonthPts} → {s.currentMonthPts} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* House MVPs */}
          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🏅</span>
              <div>
                <h3 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  House MVPs
                </h3>
                <p className="text-sm text-[#1a1a1a]/50">Top contributor from each house this month</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {houseMVPs.map((h) => (
                <div key={h.house} className="p-4 rounded-xl bg-[#f5f3ef] text-center">
                  {houseLogos[h.house] && (
                    <img src={houseLogos[h.house]} alt={h.house} className="w-12 h-12 mx-auto mb-3 object-contain" />
                  )}
                  <p className="text-xs font-semibold text-[#1a1a1a]/40 tracking-wider mb-2">{h.house.replace('House of ', '')}</p>
                  {h.mvp ? (
                    <>
                      <p className="font-bold text-[#1a1a1a]">{h.mvp.name}</p>
                      <p className="text-sm text-[#B8860B] font-semibold">{h.points} pts</p>
                    </>
                  ) : (
                    <p className="text-[#1a1a1a]/30 text-sm">No data</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grade Champions */}
          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🎓</span>
              <div>
                <h3 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Grade Champions
                </h3>
                <p className="text-sm text-[#1a1a1a]/50">Top section per grade this month</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {gradeChampions.map((g) => (
                <div key={g.grade} className="p-4 rounded-xl bg-[#f5f3ef] text-center">
                  <p className="text-xs font-semibold text-[#1a1a1a]/40 tracking-wider mb-2">Grade {g.grade}</p>
                  {g.champion ? (
                    <>
                      <p className="font-bold text-[#1a1a1a] text-sm truncate">Section {g.champion.section}</p>
                      <p className="text-sm text-[#B8860B] font-semibold">{g.points} pts</p>
                    </>
                  ) : (
                    <p className="text-[#1a1a1a]/30 text-sm">No data</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Approaching Milestones Tab */}
      {selectedTab === 'approaching' && (
        <div className="space-y-6">
          <div className="regal-card rounded-2xl p-6 bg-gradient-to-r from-[#B8860B]/5 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🎯</span>
              <h3 className="text-lg font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Students Close to Milestones
              </h3>
            </div>
            <p className="text-sm text-[#1a1a1a]/50 mb-0">Students within 20 points of reaching the next tier</p>
          </div>

          {approachingMilestones.map((tier) => (
            <div key={tier.name} className="regal-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{tier.icon}</span>
                <h4 className="font-bold text-[#1a1a1a]">Approaching {tier.name} ({tier.points} pts)</h4>
                <span className="ml-auto text-sm text-[#1a1a1a]/40">{tier.students.length} students</span>
              </div>
              {tier.students.length === 0 ? (
                <p className="text-[#1a1a1a]/30 text-center py-4">No students are within 20 points of this milestone</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tier.students.map((s, index) => (
                    <div key={`${s.name}-${s.grade}-${s.house}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f3ef]">
                      <div className="flex-1">
                        <p className="font-medium text-[#1a1a1a]">{s.name}</p>
                        <p className="text-xs text-[#1a1a1a]/40">Grade {s.grade} • {s.house}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#2D5016]">{s.totalPoints} pts</p>
                        <p className="text-xs text-[#B8860B] font-semibold">{s.pointsNeeded} to go!</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
