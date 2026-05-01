import { NextResponse } from 'next/server'
import { withSchoolScope } from '@namaa-loc/db/auth.server'
import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

import { requireRole, RoleSets } from '@/lib/apiAuth'
import { loadSchoolBranding } from '@/lib/loadSchoolBranding'
import { canonicalHouseName, getHouseLogoMap, type SchoolHouseRecord } from '@/lib/schoolHouses'
import {
  buildCsv,
  buildPrintableReportHtml,
  MAX_DETAIL_EXPORT_ROWS,
  MAX_SUMMARY_EXPORT_ROWS,
  OversizedReportError,
  ReportExportError,
  sanitizeFilenameSegment,
} from '@/lib/reportExport'

type ReportFormat = 'CSV' | 'PDF'
type ReportTemplateId =
  | 'all-time-summary'
  | 'house-snapshot'
  | 'grade-section-leaderboard'
  | 'category-report'
  | 'monthly-merit'
  | 'monthly-highlights'
  | 'leadership-summary'
  | 'staff-recognition'
  | 'student'
  | 'house'
  | 'grade'
  | 'section'

type SelectedStudent = {
  id: string
  name: string
  grade: number
  section: string
  house?: string
}

type ExportRequestBody = {
  templateId?: ReportTemplateId
  format?: ReportFormat
  startDate?: string
  endDate?: string
  student?: SelectedStudent
  house?: string
  grade?: string
  section?: string
}

type MeritEntry = {
  student_id: string | null
  student_name: string | null
  grade: number | null
  section: string | null
  house: string | null
  points: number | null
  staff_name: string | null
  r: string | null
  subcategory: string | null
  timestamp: string | null
  notes: string | null
}

type StaffRow = {
  staff_name: string | null
}

type ReportArtifact = {
  title: string
  filenameBase: string
  csvRows: (string | number)[][]
  pdf: {
    subtitle: string
    headers?: string[]
    rows?: (string | number)[][]
    variant?: 'default' | 'student'
    summaryCards?: Array<{ label: string; value: string | number }>
    paragraphs?: string[]
    charts?: Array<
      | { kind: 'bar'; title: string; data: Array<{ label: string; value: number }> }
      | { kind: 'line'; title: string; data: Array<{ label: string; value: number }> }
    >
    heroImageUrl?: string
    heroImageAlt?: string
  }
}

type ReportSupabase = ReturnType<typeof createSupabaseServiceRoleClient>

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US')
const STUDENT_FILTER_LIMIT = 10000

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  return DATE_FORMATTER.format(parsed)
}

function getThreeRCategory(value: string | number | null | undefined) {
  const raw = `${value ?? ''}`.toLowerCase()
  if (raw.includes('respect')) return 'Respect'
  if (raw.includes('responsibility')) return 'Responsibility'
  if (raw.includes('righteousness')) return 'Righteousness'
  return ''
}

function currentMonthWindow() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  return {
    startDate: start.toISOString().split('T')[0] || '',
    endDate: end.toISOString().split('T')[0] || '',
    label: key,
  }
}

function resolveDateWindow(
  body: ExportRequestBody,
  defaultScope: 'all-time' | 'current-month'
) {
  if (body.startDate || body.endDate) {
    return {
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      label: `${body.startDate || '...'} to ${body.endDate || '...'}`,
    }
  }

  if (defaultScope === 'current-month') {
    return currentMonthWindow()
  }

  return {
    startDate: null,
    endDate: null,
    label: 'All time',
  }
}

function createFilename(base: string, extension: 'csv' | 'html') {
  return `${sanitizeFilenameSegment(base)}.${extension}`
}

function csvResponse(filenameBase: string, rows: (string | number)[][]) {
  return new Response(buildCsv(rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${createFilename(filenameBase, 'csv')}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function htmlResponse(filenameBase: string, title: string, html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${createFilename(filenameBase, 'html')}"`,
      'X-Report-Title': title,
      'Cache-Control': 'no-store',
    },
  })
}

function normalizeNote(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function toNumber(value: unknown) {
  return Number(value) || 0
}

function buildSummary(entries: MeritEntry[]) {
  const totalPoints = entries.reduce((sum, entry) => sum + toNumber(entry.points), 0)
  const uniqueStudents = new Set(
    entries.map((entry) => `${entry.student_name || ''}|${entry.grade || ''}|${entry.section || ''}`)
  ).size
  const activeStaff = new Set(entries.map((entry) => String(entry.staff_name || '')).filter(Boolean)).size
  return { totalPoints, uniqueStudents, activeStaff, awards: entries.length }
}

async function fetchMeritEntries(
  supabase: ReportSupabase,
  schoolId: string,
  columns: string,
  body: ExportRequestBody,
  options: {
    defaultScope: 'all-time' | 'current-month'
    maxRows: number
    filters?: Array<{ column: 'student_id' | 'house' | 'grade' | 'section'; value: string | number }>
  }
) {
  const dateWindow = resolveDateWindow(body, options.defaultScope)

  let query = supabase
    .from('merit_log')
    .select(columns)
    .eq('school_id', schoolId)
    .order('timestamp', { ascending: false })

  if (dateWindow.startDate) {
    query = query.gte('timestamp', `${dateWindow.startDate}T00:00:00`)
  }
  if (dateWindow.endDate) {
    query = query.lte('timestamp', `${dateWindow.endDate}T23:59:59.999`)
  }

  for (const filter of options.filters || []) {
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.range(0, options.maxRows)

  if (error) {
    throw new ReportExportError(error.message, 500)
  }

  const rows = (data || []) as unknown as MeritEntry[]
  if (rows.length > options.maxRows) {
    throw new OversizedReportError()
  }

  return { entries: rows, dateWindow }
}

async function fetchReportFilters(supabase: ReportSupabase, schoolId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('grade, section')
    .eq('school_id', schoolId)
    .order('grade', { ascending: true })
    .range(0, STUDENT_FILTER_LIMIT)

  if (error) {
    throw new ReportExportError(error.message, 500)
  }

  const grades = Array.from(
    new Set(
      (data || [])
        .map((row) => Number(row.grade))
        .filter((grade) => Number.isFinite(grade) && grade > 0)
    )
  ).sort((a, b) => a - b)

  const sectionsByGrade = (data || []).reduce<Record<string, string[]>>((acc, row) => {
    const grade = Number(row.grade)
    const section = String(row.section || '').trim()
    if (!Number.isFinite(grade) || !section) return acc
    const key = String(grade)
    acc[key] = acc[key] || []
    if (!acc[key].includes(section)) {
      acc[key].push(section)
      acc[key].sort((a, b) => a.localeCompare(b))
    }
    return acc
  }, {})

  return { grades, sectionsByGrade }
}

async function fetchStaffNames(supabase: ReportSupabase, schoolId: string) {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_name')
    .eq('school_id', schoolId)
  if (error) {
    throw new ReportExportError(error.message, 500)
  }
  return (data || []) as StaffRow[]
}

async function loadSchoolHouseRecords(
  supabase: ReportSupabase,
  schoolId: string
): Promise<SchoolHouseRecord[]> {
  const { data, error } = await supabase
    .from('houses')
    .select('name, display_name, value, color, icon_url, sort_order, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    throw new ReportExportError(error.message, 500)
  }

  return (data || []) as SchoolHouseRecord[]
}

function buildStudentArtifact(
  body: ExportRequestBody,
  entries: MeritEntry[],
  rangeLabel: string
): ReportArtifact {
  const student = body.student
  if (!student?.id) {
    throw new ReportExportError('Select a student before generating a report.', 400)
  }

  const totalPoints = entries.reduce((sum, entry) => sum + toNumber(entry.points), 0)
  const awards = entries.length
  const dates = entries
    .map((entry) => new Date(entry.timestamp || ''))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  const firstDate = dates[0] ? DATE_FORMATTER.format(dates[0]) : '—'
  const lastDate = dates[dates.length - 1] ? DATE_FORMATTER.format(dates[dates.length - 1]) : '—'
  const activeWeeks = new Set(
    dates.map((date) => {
      const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      const day = normalized.getUTCDay()
      const diff = day === 0 ? -6 : 1 - day
      normalized.setUTCDate(normalized.getUTCDate() + diff)
      return normalized.toISOString().split('T')[0] || ''
    })
  )

  const categoryCounts: Record<string, number> = {}
  const noteSnippets: string[] = []
  for (const entry of entries) {
    const category = getThreeRCategory(entry.r)
    if (category) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    }
    const note = normalizeNote(entry.notes)
    if (note && !noteSnippets.includes(note)) {
      noteSnippets.push(note)
    }
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => category)

  const strengthLine = (() => {
    if (topCategories.length === 0) {
      return 'Teachers highlighted positive conduct and steady contributions to the learning community.'
    }
    const mapped = topCategories.map((category) => {
      if (category.toLowerCase().includes('respect')) return 'positive conduct and respect for others'
      if (category.toLowerCase().includes('responsibility')) return 'responsibility and self-management'
      if (category.toLowerCase().includes('righteousness')) return 'integrity and good judgment'
      return category
    })
    return `Teachers highlighted ${mapped.join(' and ')} during this period.`
  })()

  const noteLine = (() => {
    if (noteSnippets.length === 0) return ''
    const picks = noteSnippets.slice(0, 3).map((note) => (note.length > 140 ? `${note.slice(0, 137)}...` : note))
    return `Notable moments include ${picks.join(' • ')}.`
  })()

  const rows = entries.map((entry) => ([
    formatDisplayDate(entry.timestamp),
    toNumber(entry.points),
    getThreeRCategory(entry.r),
    entry.subcategory || '',
    entry.staff_name || '',
    normalizeNote(entry.notes),
  ]))

  const summaryLine = `Across ${activeWeeks.size} week${activeWeeks.size === 1 ? '' : 's'}, ${student.name} received ${awards} recognition${awards === 1 ? '' : 's'} and ${totalPoints} total points.`
  const trendLine = `Between ${firstDate} and ${lastDate}, ${strengthLine}`
  const closingLine = `In short, ${student.name} shows a steady, positive presence that teachers notice and appreciate.`

  return {
    title: `Student Report: ${student.name}`,
    filenameBase: `report_student_${student.name}_${student.grade}${student.section}`,
    csvRows: [
      ['Date', 'Points', 'Category', 'Subcategory', 'Staff Name', 'Notes'],
      ...rows,
    ],
    pdf: {
      subtitle: `Grade ${student.grade}${student.section} • ${student.house || 'House'} • ${rangeLabel}`,
      headers: ['Date', 'Points', 'Category', 'Subcategory', 'Staff Name', 'Notes'],
      rows,
      variant: 'student',
      summaryCards: [
        { label: 'Total Points', value: totalPoints },
        { label: 'Awards', value: awards },
        { label: 'First Entry', value: firstDate },
        { label: 'Last Entry', value: lastDate },
      ],
      paragraphs: [summaryLine, trendLine, noteLine, closingLine].filter(Boolean),
    },
  }
}

async function buildReportArtifact(
  supabase: ReportSupabase,
  schoolId: string,
  branding: Awaited<ReturnType<typeof loadSchoolBranding>>,
  houseRecords: SchoolHouseRecord[],
  body: ExportRequestBody,
  origin: string
): Promise<ReportArtifact> {
  const templateId = body.templateId
  const houseLogoMap = getHouseLogoMap(houseRecords)
  if (!templateId) {
    throw new ReportExportError('Missing report template.', 400)
  }

  if (templateId === 'all-time-summary') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, r, timestamp',
      body,
      { defaultScope: 'all-time', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )
    const houseTotals: Record<string, number> = {}
    const gradeTotals: Record<string, number> = {}
    const staffTotals: Record<string, number> = {}
    const categoryTotals: Record<string, number> = {}

    for (const entry of entries) {
      const house = entry.house || ''
      const grade = entry.grade || ''
      const staff = entry.staff_name || ''
      const category = getThreeRCategory(entry.r)
      const points = toNumber(entry.points)
      if (house) houseTotals[house] = (houseTotals[house] || 0) + points
      if (grade) gradeTotals[String(grade)] = (gradeTotals[String(grade)] || 0) + points
      if (staff) staffTotals[staff] = (staffTotals[staff] || 0) + points
      if (category) categoryTotals[category] = (categoryTotals[category] || 0) + points
    }

    const dataRows: (string | number)[][] = [
      ...Object.entries(houseTotals).map(([label, points]) => ['House', label, points]),
      ...Object.entries(gradeTotals).map(([label, points]) => ['Grade', `Grade ${label}`, points]),
      ...Object.entries(staffTotals).map(([label, points]) => ['Staff', label, points]),
      ...Object.entries(categoryTotals).map(([label, points]) => ['Category', label, points]),
    ]
    const summary = buildSummary(entries)

    return {
      title: 'All-Time Merit Summary',
      filenameBase: `report_all_time_summary_${dateWindow.label}`,
      csvRows: [['Section', 'Label', 'Points'], ...dataRows],
      pdf: {
        subtitle: `${dateWindow.label} • ${entries.length} recognitions`,
        headers: ['Section', 'Label', 'Points'],
        rows: dataRows,
        summaryCards: [
          { label: 'Total Points', value: summary.totalPoints },
          { label: 'Awards', value: summary.awards },
          { label: 'Students', value: summary.uniqueStudents },
          { label: 'Active Staff', value: summary.activeStaff },
        ],
      },
    }
  }

  if (templateId === 'house-snapshot') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, timestamp',
      body,
      { defaultScope: 'all-time', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )

    const houseTotals: Record<string, { points: number; awards: number; students: Set<string>; staff: Set<string> }> = {}
    for (const entry of entries) {
      const house = String(entry.house || '').trim()
      if (!house) continue
      if (!houseTotals[house]) {
        houseTotals[house] = { points: 0, awards: 0, students: new Set(), staff: new Set() }
      }
      houseTotals[house].points += toNumber(entry.points)
      houseTotals[house].awards += 1
      if (entry.student_name) {
        houseTotals[house].students.add(`${entry.student_name}|${entry.grade || ''}|${entry.section || ''}`)
      }
      if (entry.staff_name) {
        houseTotals[house].staff.add(String(entry.staff_name))
      }
    }

    const rows = Object.entries(houseTotals)
      .map(([house, stats]) => [
        house,
        stats.points,
        stats.awards,
        stats.students.size,
        stats.staff.size,
      ])
      .sort((a, b) => Number(b[1]) - Number(a[1]))

    return {
      title: 'House Performance Snapshot',
      filenameBase: `report_house_snapshot_${dateWindow.label}`,
      csvRows: [['House', 'Total Points', 'Awards', 'Unique Students', 'Active Staff'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • ${rows.length} houses`,
        headers: ['House', 'Total Points', 'Awards', 'Unique Students', 'Active Staff'],
        rows,
      },
    }
  }

  if (templateId === 'grade-section-leaderboard') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'grade, section, points, timestamp',
      body,
      { defaultScope: 'all-time', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )
    const sectionTotals: Record<string, number> = {}

    for (const entry of entries) {
      const grade = entry.grade || ''
      const section = entry.section || ''
      if (!grade || !section) continue
      const key = `${grade}|${section}`
      sectionTotals[key] = (sectionTotals[key] || 0) + toNumber(entry.points)
    }

    const rows = Object.entries(sectionTotals)
      .map(([key, points]) => {
        const [grade, section] = key.split('|')
        return [`Grade ${grade}${section}`, points]
      })
      .sort((a, b) => Number(b[1]) - Number(a[1]))

    return {
      title: 'Grade & Section Leaderboard',
      filenameBase: `report_grade_section_leaderboard_${dateWindow.label}`,
      csvRows: [['Grade/Section', 'Total Points'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • ${rows.length} sections`,
        headers: ['Grade/Section', 'Total Points'],
        rows,
      },
    }
  }

  if (templateId === 'category-report') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'points, r, subcategory, timestamp',
      body,
      { defaultScope: 'all-time', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )
    const categoryTotals: Record<string, number> = {}
    const subcategoryTotals: Record<string, number> = {}

    for (const entry of entries) {
      const category = getThreeRCategory(entry.r)
      const subcategory = entry.subcategory || ''
      if (category) categoryTotals[category] = (categoryTotals[category] || 0) + toNumber(entry.points)
      if (subcategory) subcategoryTotals[subcategory] = (subcategoryTotals[subcategory] || 0) + toNumber(entry.points)
    }

    const rows: (string | number)[][] = [
      ...Object.entries(categoryTotals).map(([label, points]) => ['Category', label, points]),
      ...Object.entries(subcategoryTotals).map(([label, points]) => ['Subcategory', label, points]),
    ]

    return {
      title: 'Merit Category Report',
      filenameBase: `report_merit_categories_${dateWindow.label}`,
      csvRows: [['Type', 'Label', 'Total Points'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • Categories and subcategories`,
        headers: ['Type', 'Label', 'Total Points'],
        rows,
      },
    }
  }

  if (templateId === 'monthly-merit') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, r, subcategory, timestamp',
      body,
      { defaultScope: 'current-month', maxRows: MAX_DETAIL_EXPORT_ROWS }
    )

    const rows = entries.map((entry) => ([
      formatDisplayDate(entry.timestamp),
      entry.student_name || '',
      entry.grade || '',
      entry.section || '',
      entry.house || '',
      toNumber(entry.points),
      entry.staff_name || '',
      getThreeRCategory(entry.r),
      entry.subcategory || '',
    ]))

    return {
      title: 'Monthly Merit Log',
      filenameBase: `report_monthly_merit_${dateWindow.label}`,
      csvRows: [['Date', 'Student Name', 'Grade', 'Section', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • ${entries.length} entries`,
        headers: ['Date', 'Student Name', 'Grade', 'Section', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'],
        rows,
      },
    }
  }

  if (templateId === 'monthly-highlights') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, timestamp',
      body,
      { defaultScope: 'current-month', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )

    const studentPoints: Record<string, { name: string; points: number }> = {}
    const staffPoints: Record<string, number> = {}
    const housePoints: Record<string, number> = {}

    for (const entry of entries) {
      const student = String(entry.student_name ?? '').trim()
      if (student) {
        const key = `${student}|${entry.grade || ''}|${entry.section || ''}`
        if (!studentPoints[key]) {
          studentPoints[key] = { name: student, points: 0 }
        }
        studentPoints[key].points += toNumber(entry.points)
      }
      const staff = entry.staff_name || ''
      if (staff) staffPoints[staff] = (staffPoints[staff] || 0) + toNumber(entry.points)
      const house = String(entry.house ?? '').trim()
      if (house) housePoints[house] = (housePoints[house] || 0) + toNumber(entry.points)
    }

    const topStudents = Object.values(studentPoints).sort((a, b) => b.points - a.points).slice(0, 5)
    const topStaff = Object.entries(staffPoints).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topHouses = Object.entries(housePoints).sort((a, b) => b[1] - a[1]).slice(0, 4)

    const rows: (string | number)[][] = [
      ...topStudents.map((student) => ['Top Student', student.name, student.points]),
      ...topStaff.map(([name, points]) => ['Top Staff', name, points]),
      ...topHouses.map(([name, points]) => ['Top House', name, points]),
    ]

    return {
      title: 'Monthly Highlights',
      filenameBase: `report_monthly_highlights_${dateWindow.label}`,
      csvRows: [['Category', 'Label', 'Points'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • ${entries.length} recognitions`,
        headers: ['Category', 'Label', 'Points'],
        rows,
      },
    }
  }

  if (templateId === 'leadership-summary') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, r, timestamp',
      body,
      { defaultScope: 'all-time', maxRows: MAX_SUMMARY_EXPORT_ROWS }
    )

    const houseTotals: Record<string, number> = {}
    const sectionTotals: Record<string, number> = {}
    const categoryTotals: Record<string, number> = {}
    const monthlyTotals: Record<string, number> = {}
    const studentSet = new Set<string>()
    const staffSet = new Set<string>()

    for (const entry of entries) {
      const house = String(entry.house ?? '').trim()
      if (house) houseTotals[house] = (houseTotals[house] || 0) + toNumber(entry.points)
      if (entry.grade && entry.section) {
        const key = `Grade ${entry.grade}${entry.section}`
        sectionTotals[key] = (sectionTotals[key] || 0) + toNumber(entry.points)
      }
      const category = getThreeRCategory(entry.r)
      if (category) categoryTotals[category] = (categoryTotals[category] || 0) + toNumber(entry.points)
      if (entry.timestamp) {
        const date = new Date(entry.timestamp)
        if (Number.isFinite(date.getTime())) {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthlyTotals[key] = (monthlyTotals[key] || 0) + toNumber(entry.points)
        }
      }
      if (entry.student_name) {
        studentSet.add(`${entry.student_name}|${entry.grade || ''}|${entry.section || ''}`)
      }
      if (entry.staff_name) {
        staffSet.add(String(entry.staff_name))
      }
    }

    const houseData = Object.entries(houseTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    const sectionData = Object.entries(sectionTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const categoryData = Object.entries(categoryTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    const monthData = Object.entries(monthlyTotals)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, value]) => ({ label, value }))

    const totalPoints = entries.reduce((sum, entry) => sum + toNumber(entry.points), 0)
    const totalAwards = entries.length
    const uniqueStudents = studentSet.size
    const activeStaff = staffSet.size
    const avgPerStudent = uniqueStudents > 0 ? Math.round(totalPoints / uniqueStudents) : 0
    const avgPerAward = totalAwards > 0 ? Math.round(totalPoints / totalAwards) : 0
    const topHouse = houseData[0]?.label || '—'
    const topSection = sectionData[0]?.label || '—'
    const topCategory = categoryData[0]?.label || '—'
    const trendDirection = monthData.length >= 2 && monthData[monthData.length - 1].value >= monthData[monthData.length - 2].value
      ? 'upward'
      : 'downward'

    const csvRows: (string | number)[][] = [
      ['Section', 'Label', 'Value'],
      ...houseData.map((datum) => ['House', datum.label, datum.value]),
      ...sectionData.map((datum) => ['Grade/Section', datum.label, datum.value]),
      ...categoryData.map((datum) => ['Category', datum.label, datum.value]),
      ...monthData.map((datum) => ['Month', datum.label, datum.value]),
      ['Metric', 'Total Points', totalPoints],
      ['Metric', 'Total Awards', totalAwards],
      ['Metric', 'Unique Students', uniqueStudents],
      ['Metric', 'Active Staff', activeStaff],
      ['Metric', 'Avg Points per Student', avgPerStudent],
      ['Metric', 'Avg Points per Award', avgPerAward],
    ]

    return {
      title: 'Leadership Summary',
      filenameBase: `report_leadership_summary_${dateWindow.label}`,
      csvRows,
      pdf: {
        subtitle: `${dateWindow.label} • ${entries.length} recognitions`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Top House', topHouse],
          ['Top Section', topSection],
          ['Top Category', topCategory],
          ['Trend Direction', trendDirection],
        ],
        summaryCards: [
          { label: 'Total Points', value: totalPoints },
          { label: 'Awards', value: totalAwards },
          { label: 'Students', value: uniqueStudents },
          { label: 'Active Staff', value: activeStaff },
          { label: 'Avg/Student', value: avgPerStudent },
          { label: 'Avg/Award', value: avgPerAward },
        ],
        paragraphs: [
          `Overall engagement is led by ${topHouse}, with ${topSection} currently topping section totals.`,
          `${topCategory} remains the most recognized character focus across the selected period.`,
          `The month-over-month trend is ${trendDirection}.`,
        ],
        charts: [
          { kind: 'bar', title: 'Points by House', data: houseData },
          { kind: 'bar', title: 'Points by Grade/Section (Top 10)', data: sectionData },
          { kind: 'bar', title: '3R Distribution', data: categoryData },
          { kind: 'line', title: 'Monthly Trend', data: monthData },
        ],
      },
    }
  }

  if (templateId === 'staff-recognition') {
    const [{ entries, dateWindow }, staffRows] = await Promise.all([
      fetchMeritEntries(
        supabase,
        schoolId,
        'points, staff_name, timestamp',
        body,
        { defaultScope: 'current-month', maxRows: MAX_SUMMARY_EXPORT_ROWS }
      ),
      fetchStaffNames(supabase, schoolId),
    ])

    const normalizeStaff = (value: string) =>
      value
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')

    const staffPoints: Record<string, number> = {}
    const staffWeeks: Record<string, Set<string>> = {}
    const staffKeyMap = new Map<string, string>()

    for (const row of staffRows) {
      const name = row.staff_name || ''
      if (!name) continue
      const key = normalizeStaff(name)
      staffKeyMap.set(key, name)
      staffPoints[key] = 0
      staffWeeks[key] = new Set()
    }

    const weekKey = (date: Date) => {
      const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      const day = normalized.getUTCDay()
      const diff = day === 0 ? -6 : 1 - day
      normalized.setUTCDate(normalized.getUTCDate() + diff)
      return normalized.toISOString().split('T')[0] || ''
    }

    for (const entry of entries) {
      const date = new Date(entry.timestamp || '')
      if (!Number.isFinite(date.getTime())) continue
      const staff = normalizeStaff(String(entry.staff_name ?? ''))
      if (!staff) continue
      if (!(staff in staffPoints)) {
        staffPoints[staff] = 0
        staffWeeks[staff] = new Set()
        staffKeyMap.set(staff, String(entry.staff_name ?? '').trim())
      }
      staffPoints[staff] += toNumber(entry.points)
      staffWeeks[staff].add(weekKey(date))
    }

    const rows = Array.from(staffKeyMap.entries())
      .map(([key, name]) => [name, staffPoints[key] || 0, staffWeeks[key]?.size || 0])
      .sort((a, b) => Number(b[1]) - Number(a[1]))

    return {
      title: 'Staff Recognition',
      filenameBase: `report_staff_recognition_${dateWindow.label}`,
      csvRows: [['Staff Member', 'Points', 'Active Weeks'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • ${rows.length} staff members`,
        headers: ['Staff Member', 'Points', 'Active Weeks'],
        rows,
      },
    }
  }

  if (templateId === 'student') {
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_id, student_name, grade, section, house, points, staff_name, r, subcategory, timestamp, notes',
      body,
      {
        defaultScope: 'all-time',
        maxRows: MAX_DETAIL_EXPORT_ROWS,
        filters: body.student?.id ? [{ column: 'student_id', value: body.student.id }] : [],
      }
    )
    return buildStudentArtifact(body, entries, dateWindow.label)
  }

  if (templateId === 'house') {
    if (!body.house) {
      throw new ReportExportError('Select a house before generating a report.', 400)
    }
    const selectedHouse = canonicalHouseName(body.house, houseRecords)
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, grade, section, house, points, staff_name, r, subcategory, timestamp',
      body,
      {
        defaultScope: 'all-time',
        maxRows: MAX_DETAIL_EXPORT_ROWS,
        filters: [{ column: 'house', value: selectedHouse }],
      }
    )
    const summary = buildSummary(entries)
    const rows = entries.map((entry) => ([
      formatDisplayDate(entry.timestamp),
      entry.student_name || '',
      entry.grade || '',
      entry.section || '',
      toNumber(entry.points),
      entry.staff_name || '',
      getThreeRCategory(entry.r),
      entry.subcategory || '',
    ]))
    const heroImagePath = houseLogoMap[selectedHouse] || houseLogoMap[body.house]
    const heroImageUrl = heroImagePath ? `${origin}${heroImagePath}` : undefined

    return {
      title: `House Report: ${selectedHouse || body.house}`,
      filenameBase: `report_house_${selectedHouse || body.house}_${dateWindow.label}`,
      csvRows: [['Date', 'Student Name', 'Grade', 'Section', 'Points', 'Staff Name', 'Category', 'Subcategory'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • Total Points: ${summary.totalPoints} • Awards: ${summary.awards} • Students: ${summary.uniqueStudents} • Staff: ${summary.activeStaff}`,
        headers: ['Date', 'Student Name', 'Grade', 'Section', 'Points', 'Staff Name', 'Category', 'Subcategory'],
        rows,
        heroImageUrl,
        heroImageAlt: `${body.house} logo`,
      },
    }
  }

  if (templateId === 'grade') {
    if (!body.grade) {
      throw new ReportExportError('Select a grade before generating a report.', 400)
    }
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, section, house, points, staff_name, r, subcategory, timestamp, grade',
      body,
      {
        defaultScope: 'all-time',
        maxRows: MAX_DETAIL_EXPORT_ROWS,
        filters: [{ column: 'grade', value: Number(body.grade) }],
      }
    )
    const summary = buildSummary(entries)
    const rows = entries.map((entry) => ([
      formatDisplayDate(entry.timestamp),
      entry.student_name || '',
      entry.section || '',
      entry.house || '',
      toNumber(entry.points),
      entry.staff_name || '',
      getThreeRCategory(entry.r),
      entry.subcategory || '',
    ]))

    return {
      title: `Grade Report: Grade ${body.grade}`,
      filenameBase: `report_grade_${body.grade}_${dateWindow.label}`,
      csvRows: [['Date', 'Student Name', 'Section', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • Total Points: ${summary.totalPoints} • Awards: ${summary.awards} • Students: ${summary.uniqueStudents} • Staff: ${summary.activeStaff}`,
        headers: ['Date', 'Student Name', 'Section', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'],
        rows,
      },
    }
  }

  if (templateId === 'section') {
    if (!body.grade || !body.section) {
      throw new ReportExportError('Select both grade and section before generating a report.', 400)
    }
    const { entries, dateWindow } = await fetchMeritEntries(
      supabase,
      schoolId,
      'student_name, house, points, staff_name, r, subcategory, timestamp, grade, section',
      body,
      {
        defaultScope: 'all-time',
        maxRows: MAX_DETAIL_EXPORT_ROWS,
        filters: [
          { column: 'grade', value: Number(body.grade) },
          { column: 'section', value: body.section },
        ],
      }
    )
    const summary = buildSummary(entries)
    const rows = entries.map((entry) => ([
      formatDisplayDate(entry.timestamp),
      entry.student_name || '',
      entry.house || '',
      toNumber(entry.points),
      entry.staff_name || '',
      getThreeRCategory(entry.r),
      entry.subcategory || '',
    ]))

    return {
      title: `Grade/Section Report: Grade ${body.grade}${body.section}`,
      filenameBase: `report_grade_${body.grade}_section_${body.section}_${dateWindow.label}`,
      csvRows: [['Date', 'Student Name', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'], ...rows],
      pdf: {
        subtitle: `${dateWindow.label} • Total Points: ${summary.totalPoints} • Awards: ${summary.awards} • Students: ${summary.uniqueStudents} • Staff: ${summary.activeStaff}`,
        headers: ['Date', 'Student Name', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory'],
        rows,
      },
    }
  }

  throw new ReportExportError(`Unknown report template: ${templateId}`, 400)
}

export async function GET() {
  try {
    return await withSchoolScope(async (schoolId) => {
      const auth = await requireRole(RoleSets.admin)
      if (auth.error || !auth.supabase) {
        return auth.error
      }

      const supabase = createSupabaseServiceRoleClient()
      const filters = await fetchReportFilters(supabase, schoolId)
      return NextResponse.json(filters, { headers: { 'Cache-Control': 'no-store' } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Missing school context.') {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 401 })
    }

    const message = error instanceof Error ? error.message : 'Failed to load report filters'
    const status = error instanceof ReportExportError ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    return await withSchoolScope(async (schoolId) => {
      const auth = await requireRole(RoleSets.admin)
      if (auth.error || !auth.supabase) {
        return auth.error
      }

      const supabase = createSupabaseServiceRoleClient()
      const body = (await request.json()) as ExportRequestBody
      if (!body.format || !['CSV', 'PDF'].includes(body.format)) {
        throw new ReportExportError('Missing or invalid report format.', 400)
      }

      const [branding, houseRecords] = await Promise.all([
        loadSchoolBranding(schoolId),
        loadSchoolHouseRecords(supabase, schoolId),
      ])

      const artifact = await buildReportArtifact(supabase, schoolId, branding, houseRecords, body, new URL(request.url).origin)
      if (body.format === 'CSV') {
        return csvResponse(artifact.filenameBase, artifact.csvRows)
      }

      const crestUrl = branding.logoUrl.startsWith('http')
        ? branding.logoUrl
        : `${new URL(request.url).origin}${branding.logoUrl}`

      const html = buildPrintableReportHtml({
        title: artifact.title,
        subtitle: artifact.pdf.subtitle,
        brandLine: `${branding.programName} • ${branding.schoolName}`,
        crestUrl,
        headers: artifact.pdf.headers,
        rows: artifact.pdf.rows,
        variant: artifact.pdf.variant,
        summaryCards: artifact.pdf.summaryCards,
        paragraphs: artifact.pdf.paragraphs,
        charts: artifact.pdf.charts,
        heroImageUrl: artifact.pdf.heroImageUrl,
        heroImageAlt: artifact.pdf.heroImageAlt,
      })
      return htmlResponse(artifact.filenameBase, artifact.title, html)
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Missing school context.') {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 401 })
    }

    const message = error instanceof Error ? error.message : 'Failed to generate report export'
    const status = error instanceof ReportExportError ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
