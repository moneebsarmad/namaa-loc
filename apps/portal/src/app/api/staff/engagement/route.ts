import { NextResponse } from 'next/server'
import { withSchoolScope } from '@namaa-loc/db/auth.server'
import { createSupabaseServerClient } from '@namaa-loc/db/server'
import { requireRole, RoleSets } from '@/lib/apiAuth'
import { getSchoolDays } from '@/lib/schoolDays'
import { canonicalHouseName, type SchoolHouseRecord } from '@/lib/schoolHouses'

const MIN_NOTES_CHARS = 10
const BASELINE_DAYS = 14
const EPSILON = 0.000001

type MeritRow = {
  staff_name: string | null
  student_name?: string | null
  grade?: number | null
  section?: string | null
  house?: string | null
  r?: string | null
  subcategory?: string | null
  points?: number | null
  notes?: string | null
  date_of_event?: string | null
  timestamp?: string | null
}

type StaffRow = Record<string, string | number | null | undefined>

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isNotesRequired(row: MeritRow) {
  const subcategory = String(row.subcategory ?? '').trim().toLowerCase()
  const category = String(row.r ?? '').trim().toLowerCase()
  return subcategory.startsWith('other') || category === 'other' || category.startsWith('other')
}

function getEntryDate(row: MeritRow) {
  if (row.date_of_event) return row.date_of_event
  if (row.timestamp) {
    const parsed = new Date(row.timestamp)
    if (Number.isFinite(parsed.getTime())) {
      return toDateString(parsed)
    }
  }
  return ''
}

async function fetchCalendarDates(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('valid_school_days')
    .select('d')
    .eq('school_id', schoolId)
    .gte('d', startDate)
    .lte('d', endDate)
    .order('d', { ascending: true })

  if (error) {
    return []
  }

  return (data || []).map((row) => String(row.d))
}

function getThreeRCategory(value: string) {
  const raw = (value || '').toLowerCase()
  if (raw.includes('respect')) return 'Respect'
  if (raw.includes('responsibility')) return 'Responsibility'
  if (raw.includes('righteousness')) return 'Righteousness'
  return ''
}

function getStaffHouse(row: StaffRow) {
  return String(row.house ?? '').trim()
}

function getStaffGrade(row: StaffRow) {
  const keys = ['grade_assignment', 'grade_level', 'grade', 'grade_level_assigned', 'grades']
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ''
}

function buildBaselineRange(startDate: string) {
  const start = parseDate(startDate)
  const searchEnd = addDays(start, 90)
  const candidates = getSchoolDays(toDateString(start), toDateString(searchEnd))
  if (candidates.length === 0) return null
  const slice = candidates.slice(0, BASELINE_DAYS)
  return {
    start: slice[0],
    end: slice[slice.length - 1],
  }
}

function getInflationLabel(value: number | null) {
  if (value === null) return 'Not enough data'
  if (value < 0.7) return 'Low activity risk'
  if (value < 1.3) return 'Normal'
  if (value < 1.8) return 'Watch'
  return 'High inflation risk'
}

export async function GET(request: Request) {
  return withSchoolScope(async (schoolId) => {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const detail = searchParams.get('detail') || ''
    const staffFilter = searchParams.get('staffName') || ''
    const houseFilter = searchParams.get('house') || ''
    const gradeFilter = searchParams.get('grade') || ''
    const sectionFilter = searchParams.get('section') || ''

    const auth = await requireRole(RoleSets.admin)
    if (auth.error || !auth.supabase) {
      return auth.error
    }
    const supabase = auth.supabase

    if (detail === 'months') {
      const monthSet = new Set<string>()
      const pageSize = 5000
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('merit_log')
          .select('date_of_event, timestamp')
          .eq('school_id', schoolId)
          .order('date_of_event', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data || data.length === 0) {
          hasMore = false
        } else {
          data.forEach((row) => {
            const entryDate = getEntryDate(row as MeritRow)
            if (entryDate) {
              monthSet.add(entryDate.slice(0, 7))
            }
          })
          from += data.length
          hasMore = data.length === pageSize
        }
      }

      return NextResponse.json({
        months: Array.from(monthSet).sort().reverse(),
      })
    }

    if (detail === 'calendar-range') {
      const [minRes, maxRes] = await Promise.all([
        supabase
          .from('valid_school_days')
          .select('d')
          .eq('school_id', schoolId)
          .order('d', { ascending: true })
          .limit(1),
        supabase
          .from('valid_school_days')
          .select('d')
          .eq('school_id', schoolId)
          .order('d', { ascending: false })
          .limit(1),
      ])

      if (minRes.error || maxRes.error) {
        return NextResponse.json({ error: minRes.error?.message || maxRes.error?.message || 'Failed to load calendar range.' }, { status: 500 })
      }

      const minDate = minRes.data?.[0]?.d ? String(minRes.data[0].d) : ''
      const maxDate = maxRes.data?.[0]?.d ? String(maxRes.data[0].d) : ''

      return NextResponse.json({ min_date: minDate, max_date: maxDate })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date range.' }, { status: 400 })
    }

    if (detail === 'missing-notes') {
      let notesQuery = supabase
        .from('merit_log')
        .select('staff_name, student_name, grade, section, r, subcategory, points, notes, date_of_event, timestamp')
        .eq('school_id', schoolId)
        .gte('date_of_event', startDate)
        .lte('date_of_event', endDate)

      if (staffFilter) {
        notesQuery = notesQuery.eq('staff_name', staffFilter)
      }
      if (houseFilter) {
        notesQuery = notesQuery.eq('house', houseFilter)
      }
      if (gradeFilter) {
        notesQuery = notesQuery.eq('grade', Number(gradeFilter))
      }
      if (sectionFilter) {
        notesQuery = notesQuery.eq('section', sectionFilter)
      }

      const { data, error } = await notesQuery
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const rows = (data || []).filter((row) => {
        if (!isNotesRequired(row)) return false
        const notes = String(row.notes ?? '').trim()
        return notes.length < MIN_NOTES_CHARS
      })

      return NextResponse.json({
        entries: rows.map((row) => ({
          staff_name: row.staff_name || '',
          student_name: row.student_name || '',
          grade: row.grade ?? null,
          section: row.section ?? null,
          r: row.r || '',
          subcategory: row.subcategory || '',
          points: row.points ?? 0,
          notes: row.notes || '',
          date: getEntryDate(row),
        })),
      })
    }

    const [staffRes, baselineResRaw, housesRes] = await Promise.all([
      supabase.from('staff').select('*').eq('school_id', schoolId),
      supabase
        .from('baseline_config')
        .select('start_date, end_date')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('houses')
        .select('name, display_name, value')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])

    if (staffRes.error) {
      return NextResponse.json({ error: staffRes.error.message }, { status: 500 })
    }
    const baselineRes = baselineResRaw.error ? { data: [] as { start_date: string; end_date: string }[] } : baselineResRaw
    const schoolHouses = (housesRes.error ? [] : housesRes.data || []) as SchoolHouseRecord[]

    let entriesQuery = supabase
      .from('merit_log')
      .select('staff_name, student_name, grade, section, house, r, subcategory, points, notes, date_of_event, timestamp')
      .eq('school_id', schoolId)
      .gte('date_of_event', startDate)
      .lte('date_of_event', endDate)

    if (houseFilter) {
      entriesQuery = entriesQuery.eq('house', houseFilter)
    }
    if (gradeFilter) {
      entriesQuery = entriesQuery.eq('grade', Number(gradeFilter))
    }
    if (sectionFilter) {
      entriesQuery = entriesQuery.eq('section', sectionFilter)
    }

    const { data: entriesData, error: entriesError } = await entriesQuery
    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    const staffRows = (staffRes.data || []) as StaffRow[]
    const entries = (entriesData || []) as MeritRow[]

    const calendarDates = await fetchCalendarDates(supabase, schoolId, startDate, endDate)
    const schoolDays = getSchoolDays(startDate, endDate, {
      calendarDates: calendarDates.length > 0 ? calendarDates : undefined,
    })
    const schoolDaySet = new Set(schoolDays)

    const availableGrades = new Set<number>()
    const availableHouses = new Set<string>()
    entries.forEach((entry) => {
      if (entry.grade !== null && entry.grade !== undefined) {
        availableGrades.add(Number(entry.grade))
      }
      const house = canonicalHouseName(String(entry.house ?? '').trim(), schoolHouses)
      if (house) availableHouses.add(house)
    })

    const staffRoster = new Map<string, StaffRow>()
    staffRows.forEach((row) => {
      const name = String(row.staff_name ?? '').trim()
      if (!name) return
      staffRoster.set(name.toLowerCase(), row)
    })

    const staffMetrics = new Map<string, {
      staff_name: string
      email: string
      house: string
      activeDays: Set<string>
      entriesCount: number
      points: number
      housePoints: Map<string, number>
      students: Set<string>
      requiredNotesEntries: number
      requiredNotesCompleted: number
      categories: Set<string>
      subcategories: Set<string>
      lastActive: string
      rosterFlags: {
        missing_house: boolean
        missing_grade: boolean
        inactive: boolean
        unknown_staff_record: boolean
      }
    }>()

    const unknownStaffCounts = new Map<string, { count: number; lastActive: string }>()
    let unknownStaffEntries = 0

    const ensureStaffMetric = (staffName: string, rosterRow?: StaffRow) => {
      const key = staffName.toLowerCase()
      if (staffMetrics.has(key)) return staffMetrics.get(key)!
      const email = rosterRow ? String(rosterRow.email ?? '') : ''
      const house = rosterRow ? getStaffHouse(rosterRow) : ''
      const missingHouse = rosterRow ? !getStaffHouse(rosterRow) : false
      const missingGrade = rosterRow ? !getStaffGrade(rosterRow) : false
      const metrics = {
        staff_name: staffName,
        email,
        house,
        activeDays: new Set<string>(),
        entriesCount: 0,
        points: 0,
        housePoints: new Map<string, number>(),
        students: new Set<string>(),
        requiredNotesEntries: 0,
        requiredNotesCompleted: 0,
        categories: new Set<string>(),
        subcategories: new Set<string>(),
        lastActive: '',
        rosterFlags: {
          missing_house: missingHouse,
          missing_grade: missingGrade,
          inactive: false,
          unknown_staff_record: !rosterRow,
        },
      }
      staffMetrics.set(key, metrics)
      return metrics
    }

    staffRows.forEach((row) => {
      const name = String(row.staff_name ?? '').trim()
      if (!name) return
      ensureStaffMetric(name, row)
    })

    const currentActiveLoggers = new Set<string>()

    entries.forEach((entry) => {
      const staffName = String(entry.staff_name ?? '').trim()
      if (!staffName) return
      const rosterRow = staffRoster.get(staffName.toLowerCase())
      const metrics = ensureStaffMetric(staffName, rosterRow)
      const entryDate = getEntryDate(entry)

      metrics.entriesCount += 1
      metrics.points += Number(entry.points ?? 0) || 0
      const houseName = canonicalHouseName(String(entry.house ?? '').trim(), schoolHouses)
      if (houseName) {
        metrics.housePoints.set(houseName, (metrics.housePoints.get(houseName) || 0) + (Number(entry.points ?? 0) || 0))
      }
      if (entry.student_name) {
        const key = `${String(entry.student_name).toLowerCase()}|${entry.grade ?? ''}|${String(entry.section ?? '').toLowerCase()}`
        metrics.students.add(key)
      }
      if (entryDate) {
        if (!metrics.lastActive || entryDate > metrics.lastActive) {
          metrics.lastActive = entryDate
        }
        if (schoolDaySet.has(entryDate)) {
          metrics.activeDays.add(entryDate)
        }
      }
      const category = getThreeRCategory(String(entry.r ?? ''))
      if (category) metrics.categories.add(category)
      const subcategory = String(entry.subcategory ?? '').trim()
      if (subcategory) metrics.subcategories.add(subcategory)

      if (isNotesRequired(entry)) {
        metrics.requiredNotesEntries += 1
        const notes = String(entry.notes ?? '').trim()
        if (notes.length >= MIN_NOTES_CHARS) {
          metrics.requiredNotesCompleted += 1
        }
      }

      currentActiveLoggers.add(staffName.toLowerCase())

      if (!rosterRow) {
        unknownStaffEntries += 1
        const existing = unknownStaffCounts.get(staffName) || { count: 0, lastActive: '' }
        existing.count += 1
        if (entryDate && (!existing.lastActive || entryDate > existing.lastActive)) {
          existing.lastActive = entryDate
        }
        unknownStaffCounts.set(staffName, existing)
      }
    })

    const missingHouseStaff = staffRows
      .filter((row) => !getStaffHouse(row))
      .map((row) => String(row.staff_name ?? '').trim())
      .filter(Boolean)
    const missingGradeStaff = staffRows
      .filter((row) => !getStaffGrade(row))
      .map((row) => String(row.staff_name ?? '').trim())
      .filter(Boolean)

    staffMetrics.forEach((metrics) => {
      metrics.rosterFlags.inactive = metrics.entriesCount === 0
    })

    let baselineRange = null as { start: string; end: string } | null
    let baselineSource: 'configured' | 'fallback' | 'missing' = 'missing'

    if (baselineRes.data && baselineRes.data.length > 0) {
      const row = baselineRes.data[0]
      if (row.start_date && row.end_date) {
        baselineRange = { start: row.start_date, end: row.end_date }
        baselineSource = 'configured'
      }
    }

    if (!baselineRange) {
      const { data: earliest } = await supabase
        .from('merit_log')
        .select('date_of_event, timestamp')
        .eq('school_id', schoolId)
        .order('date_of_event', { ascending: true })
        .limit(1)

      const earliestRow = earliest?.[0] as MeritRow | undefined
      const earliestDate = earliestRow ? getEntryDate(earliestRow) : ''
      if (earliestDate) {
        baselineRange = buildBaselineRange(earliestDate)
        if (baselineRange) {
          baselineSource = 'fallback'
        }
      }
    }

    let baselineRate: number | null = null
    if (baselineRange) {
      const { data: baselineEntries } = await supabase
        .from('merit_log')
        .select('staff_name, date_of_event, timestamp')
        .eq('school_id', schoolId)
        .gte('date_of_event', baselineRange.start)
        .lte('date_of_event', baselineRange.end)

      const baselineRows = (baselineEntries || []) as MeritRow[]
      const baselineStaff = new Set(
        baselineRows.map((entry) => String(entry.staff_name ?? '').trim()).filter(Boolean)
      )
      const baselineCalendarDates = await fetchCalendarDates(supabase, schoolId, baselineRange.start, baselineRange.end)
      const baselineDays = getSchoolDays(baselineRange.start, baselineRange.end, {
        calendarDates: baselineCalendarDates.length > 0 ? baselineCalendarDates : undefined,
      })
      if (baselineStaff.size > 0 && baselineDays.length > 0) {
        baselineRate = baselineRows.length / (baselineStaff.size * baselineDays.length)
      }
    }

    const currentEntries = entries.length
    const currentSchoolDays = schoolDays.length
    const currentRate = currentActiveLoggers.size > 0 && currentSchoolDays > 0
      ? currentEntries / (currentActiveLoggers.size * currentSchoolDays)
      : null
    const inflationIndex = currentRate !== null && baselineRate !== null
      ? currentRate / Math.max(EPSILON, baselineRate)
      : null

    const rosterDetails = {
      unknown_staff_entries: Array.from(unknownStaffCounts.entries()).map(([staff_name, info]) => ({
        staff_name,
        entries_count: info.count,
        last_active_date: info.lastActive || null,
      })),
      missing_house_staff: missingHouseStaff.map((name) => {
        const metric = staffMetrics.get(name.toLowerCase())
        return {
          staff_name: name,
          email: metric?.email || '',
          last_active_date: metric?.lastActive || null,
        }
      }),
      missing_grade_staff: missingGradeStaff.map((name) => {
        const metric = staffMetrics.get(name.toLowerCase())
        return {
          staff_name: name,
          email: metric?.email || '',
          last_active_date: metric?.lastActive || null,
        }
      }),
    }

    if (detail === 'roster') {
      return NextResponse.json(rosterDetails)
    }

    const staff = Array.from(staffMetrics.values()).map((metrics) => {
      const activeDays = metrics.activeDays.size
      const consistency = currentSchoolDays > 0 ? activeDays / currentSchoolDays : 0
      const notesCompliance = metrics.requiredNotesEntries > 0
        ? metrics.requiredNotesCompleted / metrics.requiredNotesEntries
        : null

      return {
        staff_id: null,
        staff_name: metrics.staff_name,
        email: metrics.email,
        house: metrics.house,
        active_days: activeDays,
        consistency_pct: Math.round(consistency * 1000) / 10,
        entries_count: metrics.entriesCount,
        points: metrics.points,
        house_points: Object.fromEntries(metrics.housePoints.entries()),
        students: metrics.students.size,
        required_notes_entries: metrics.requiredNotesEntries,
        required_notes_completed: metrics.requiredNotesCompleted,
        notes_compliance_pct: notesCompliance !== null ? Math.round(notesCompliance * 1000) / 10 : null,
        unique_categories_used: metrics.categories.size,
        unique_subcategories_used: metrics.subcategories.size,
        last_active_date: metrics.lastActive || null,
        roster_flags: metrics.rosterFlags,
      }
    })

    return NextResponse.json({
      staff,
      global: {
        inflation_index: inflationIndex !== null ? Math.round(inflationIndex * 100) / 100 : null,
        inflation_label: getInflationLabel(inflationIndex),
        baseline_range: baselineRange,
        baseline_source: baselineSource,
        roster_hygiene_counts: {
          unknown_staff_entries: unknownStaffEntries,
          missing_house_staff_count: missingHouseStaff.length,
          missing_grade_staff_count: missingGradeStaff.length,
        },
        possible_school_days: currentSchoolDays,
        available_grades: Array.from(availableGrades).sort((a, b) => a - b),
        available_houses: Array.from(availableHouses).sort(),
      },
    })
  })
}
