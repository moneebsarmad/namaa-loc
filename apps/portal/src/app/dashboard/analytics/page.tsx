'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Tables } from '@/lib/supabase/tables'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import CrestLoader from '@/components/CrestLoader'
import { AccessDenied, RequireStaff } from '@/components/PermissionGate'
import { useSearchParams } from 'next/navigation'
import { useSessionStorageState } from '@/hooks/useSessionStorageState'
import { useAuth } from '../../providers'
import { canonicalHouseName, getHouseColors, getHouseNames } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface MeritEntry {
  studentName: string
  grade: number
  section: string
  house: string
  points: number
  staffName: string
  category: string
  subcategory: string
  timestamp: string
}

interface Filters {
  house: string
  grade: string
  section: string
  staff: string
  category: string
  subcategory: string
  startDate: string
  endDate: string
}

const categoryColors = [
  '#2D5016', '#055437', '#000068', '#910000', '#B8860B', '#1a1a1a', '#3d6b1e', '#0a7a50'
]
const emptyFilters: Filters = {
  house: '',
  grade: '',
  section: '',
  staff: '',
  category: '',
  subcategory: '',
  startDate: '',
  endDate: '',
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [allEntries, setAllEntries] = useState<MeritEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalPoints: 0,
    totalRecords: 0,
    uniqueStudents: 0,
    activeStaff: 0,
    avgPerStudent: '0',
    avgPerAward: '0',
  })
  const searchParams = useSearchParams()
  const paramsApplied = useRef(false)
  const [filters, setFilters] = useSessionStorageState<Filters>('portal:analytics:filters', emptyFilters)
  const [appliedFilters, setAppliedFilters] = useSessionStorageState<Filters>('portal:analytics:appliedFilters', emptyFilters)
  const houseColors = useMemo(() => getHouseColors(schoolHouses), [schoolHouses])
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])

  const getThreeRCategory = (value: string) => {
    const raw = (value || '').toLowerCase()
    if (raw.includes('respect')) return 'Respect'
    if (raw.includes('responsibility')) return 'Responsibility'
    if (raw.includes('righteousness')) return 'Righteousness'
    return ''
  }

  const normalizeHouse = (value: string) => {
    const raw = String(value ?? '')
    const canonical = canonicalHouseName(raw, schoolHouses).trim().normalize('NFC')
    if (houseNames.includes(canonical)) return canonical
    const stripped = raw
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/['`ʿʾ]/g, "'")
      .trim()
    return canonicalHouseName(stripped, schoolHouses).trim().normalize('NFC')
  }

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const houses = houseNames.length ? houseNames : [...new Set(allEntries.map(e => e.house).filter(Boolean))]
    const grades = [...new Set(allEntries.map(e => e.grade).filter(Boolean))].sort((a, b) => a - b)
    const sections = [...new Set(allEntries.map(e => e.section).filter(Boolean))].sort()
    const staff = [...new Set(allEntries.map(e => e.staffName).filter(Boolean))].sort()
    const categories = [...new Set(allEntries.map(e => e.category).filter(Boolean))].sort()
    const subcategories = [...new Set(allEntries.map(e => e.subcategory).filter(Boolean))].sort()
    return { houses, grades, sections, staff, categories, subcategories }
  }, [allEntries, houseNames])

  // Apply filters to entries
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      if (appliedFilters.house && entry.house !== appliedFilters.house) return false
      if (appliedFilters.grade && entry.grade !== parseInt(appliedFilters.grade)) return false
      if (appliedFilters.section && entry.section !== appliedFilters.section) return false
      if (appliedFilters.staff && entry.staffName !== appliedFilters.staff) return false
      if (appliedFilters.category && entry.category !== appliedFilters.category) return false
      if (appliedFilters.subcategory && entry.subcategory !== appliedFilters.subcategory) return false
      if (appliedFilters.startDate) {
        const entryDate = new Date(entry.timestamp)
        const startDate = new Date(appliedFilters.startDate)
        if (entryDate < startDate) return false
      }
      if (appliedFilters.endDate) {
        const entryDate = new Date(entry.timestamp)
        const endDate = new Date(appliedFilters.endDate)
        endDate.setHours(23, 59, 59, 999)
        if (entryDate > endDate) return false
      }
      return true
    })
  }, [allEntries, appliedFilters])

  // Points by House chart data
  const houseChartData = useMemo(() => {
    const housePoints: Record<string, number> = {}
    filteredEntries.forEach(entry => {
      if (entry.house) {
        housePoints[entry.house] = (housePoints[entry.house] || 0) + entry.points
      }
    })
    return Object.entries(housePoints)
      .map(([name, points]) => ({ name, points, color: houseColors[name] || '#666' }))
      .sort((a, b) => b.points - a.points)
  }, [filteredEntries])

  // Points by Category chart data
  const categoryChartData = useMemo(() => {
    const categoryPoints: Record<string, number> = {}
    filteredEntries.forEach(entry => {
      if (entry.category) {
        categoryPoints[entry.category] = (categoryPoints[entry.category] || 0) + entry.points
      }
    })
    return Object.entries(categoryPoints)
      .map(([name, points], i) => ({ name, points, color: categoryColors[i % categoryColors.length] }))
      .sort((a, b) => b.points - a.points)
  }, [filteredEntries])

  const fetchData = useCallback(async () => {
    if (!currentSchoolId) {
      setAllEntries([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const pageSize = 1000
      let allMeritData: Record<string, string | number | null | undefined>[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data } = await supabase
          .from(Tables.meritLog)
          .select('*')
          .eq('school_id', currentSchoolId)
          .order('timestamp', { ascending: false })
          .range(from, from + pageSize - 1)

        if (!data || data.length === 0) {
          hasMore = false
        } else {
          allMeritData = allMeritData.concat(data)
          from += pageSize
          hasMore = data.length === pageSize
        }
      }

      if (allMeritData.length > 0) {
        const entries: MeritEntry[] = allMeritData.map((m) => ({
          studentName: String(m.student_name ?? ''),
          grade: Number(m.grade ?? 0),
          section: String(m.section ?? ''),
          house: normalizeHouse(String(m.house ?? '')),
          points: Number(m.points ?? 0),
          staffName: String(m.staff_name ?? ''),
          category: getThreeRCategory(String(m.r ?? '')),
          subcategory: String(m.subcategory ?? ''),
          timestamp: String(m.timestamp ?? ''),
        }))
        setAllEntries(entries)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentSchoolId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const totalPoints = filteredEntries.reduce((sum, entry) => sum + entry.points, 0)
    const totalRecords = filteredEntries.length
    const uniqueStudents = new Set(
      filteredEntries.map((entry) => `${entry.studentName}|${entry.grade}|${entry.section}`)
    ).size
    const activeStaff = new Set(filteredEntries.map((entry) => entry.staffName).filter(Boolean)).size
    setStats({
      totalPoints,
      totalRecords,
      uniqueStudents,
      activeStaff,
      avgPerStudent: uniqueStudents ? (totalPoints / uniqueStudents).toFixed(1) : '0',
      avgPerAward: totalRecords ? (totalPoints / totalRecords).toFixed(1) : '0',
    })
  }, [filteredEntries])

  useEffect(() => {
    if (!currentSchoolId) return
    const channel = supabase
      .channel('analytics-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: Tables.meritLog, filter: `school_id=eq.${currentSchoolId}` },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchoolId, fetchData])

  useEffect(() => {
    if (paramsApplied.current) return
    const house = searchParams.get('house') || ''
    const staff = searchParams.get('staff') || ''
    const grade = searchParams.get('grade') || ''
    const section = searchParams.get('section') || ''
    const nextFilters: Filters = {
      ...filters,
      house,
      staff,
      grade,
      section,
    }
    if (house || staff || grade || section) {
      setFilters(nextFilters)
      setAppliedFilters(nextFilters)
    }
    paramsApplied.current = true
  }, [filters, searchParams, setFilters, setAppliedFilters])

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    setAppliedFilters(filters)
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
  }

  const exportCSV = () => {
    const headers = ['Student Name', 'Grade', 'Section', 'House', 'Points', 'Staff Name', 'Category', 'Subcategory', 'Date']
    const rows = filteredEntries.map(e => [
      e.studentName,
      e.grade,
      e.section,
      e.house,
      e.points,
      e.staffName,
      e.category,
      e.subcategory,
      new Date(e.timestamp).toLocaleDateString()
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `merit_analytics_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportPDF = () => {
    const title = `Merit Analytics Report (${new Date().toLocaleDateString()})`
    const rows = filteredEntries.map((e) => ([
      e.studentName,
      e.grade,
      e.section,
      e.house,
      e.points,
      e.staffName,
      e.category,
      e.subcategory,
      new Date(e.timestamp).toLocaleDateString(),
    ]))

    const tableRows = rows.map((row) => `
      <tr>
        ${row.map((cell) => `<td>${String(cell ?? '')}</td>`).join('')}
      </tr>
    `).join('')

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 12px; }
            p { font-size: 12px; margin: 0 0 16px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f5f3ef; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Records: ${filteredEntries.length} • Total Points: ${stats.totalPoints.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Grade</th>
                <th>Section</th>
                <th>House</th>
                <th>Points</th>
                <th>Staff Name</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  if (isLoading || housesLoading) {
    return <CrestLoader label="Loading analytics..." />
  }

  const ShieldBar = (props: any) => {
    const x = typeof props.x === 'number' ? props.x : 0
    const y = typeof props.y === 'number' ? props.y : 0
    const width = typeof props.width === 'number' ? props.width : 0
    const height = typeof props.height === 'number' ? props.height : 0
    const fill = typeof props.fill === 'string' ? props.fill : '#B8860B'
    const radius = Math.min(10, width / 2)
    const taper = Math.max(6, Math.min(width * 0.22, 14))
    const bottomY = y + height
    const path = `
      M ${x} ${y + radius}
      Q ${x} ${y} ${x + radius} ${y}
      L ${x + width - radius} ${y}
      Q ${x + width} ${y} ${x + width} ${y + radius}
      L ${x + width} ${bottomY - radius}
      Q ${x + width} ${bottomY} ${x + width - radius} ${bottomY}
      L ${x + width - taper} ${bottomY}
      L ${x + width / 2} ${bottomY - Math.min(10, height * 0.15)}
      L ${x + taper} ${bottomY}
      L ${x + radius} ${bottomY}
      Q ${x} ${bottomY} ${x} ${bottomY - radius}
      Z
    `
    return (
      <g>
        <path d={path} fill={fill} />
        <path d={path} fill="rgba(255,255,255,0.12)" transform={`translate(0,${Math.min(8, height * 0.08)})`} />
      </g>
    )
  }

  const renderTopLabel = (props: any) => {
    const toNumber = (input?: number | string) => (typeof input === 'number' ? input : Number(input || 0))
    const x = toNumber(props?.x)
    const y = toNumber(props?.y)
    const width = toNumber(props?.width)
    const value = Number(props?.value ?? 0)
    return (
      <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#8a7a55" fontSize={11} fontWeight={600}>
        {value.toLocaleString()}
      </text>
    )
  }

  return (
    <RequireStaff fallback={<AccessDenied message="Staff access required." />}>
      <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
          Advanced Analytics
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Comprehensive data insights and patterns</p>
        </div>
      </div>

      {/* Filters */}
      <div className="regal-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-5 h-5 text-[#B8860B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-sm font-semibold text-[#1a1a1a] tracking-wider">Filter Data</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-5">
          {/* House Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">House</label>
            <select
              value={filters.house}
              onChange={(e) => handleFilterChange('house', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Houses</option>
              {filterOptions.houses.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Grade</label>
            <select
              value={filters.grade}
              onChange={(e) => handleFilterChange('grade', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Grades</option>
              {filterOptions.grades.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Section</label>
            <select
              value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Sections</option>
              {filterOptions.sections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Staff</label>
            <select
              value={filters.staff}
              onChange={(e) => handleFilterChange('staff', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Staff</option>
              {filterOptions.staff.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Subcategory</label>
            <select
              value={filters.subcategory}
              onChange={(e) => handleFilterChange('subcategory', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            >
              <option value="">All Subcategories</option>
              {filterOptions.subcategories.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-[#B8860B]/10">
          <button
            onClick={clearFilters}
            className="px-5 py-2.5 text-sm text-[#1a1a1a]/60 hover:text-[#1a1a1a] font-medium rounded-xl hover:bg-[#1a1a1a]/5 transition"
          >
            Clear All
          </button>
          <button
            onClick={applyFilters}
            className="btn-regal px-5 py-2.5 text-sm text-white font-medium rounded-xl"
          >
            Apply Filters
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="btn-gold px-5 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              className="px-5 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6M5 3h8l4 4v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Total Points', value: stats.totalPoints.toLocaleString(), icon: '⭐' },
          { label: 'Total Records', value: stats.totalRecords.toLocaleString(), icon: '📊' },
          { label: 'Unique Students', value: stats.uniqueStudents.toLocaleString(), icon: '👥' },
          { label: 'Active Staff', value: stats.activeStaff.toLocaleString(), icon: '👨‍🏫' },
          { label: 'Avg/Student', value: stats.avgPerStudent, icon: '📈' },
          { label: 'Avg/Award', value: stats.avgPerAward, icon: '🏆' },
        ].map((stat) => (
          <div key={stat.label} className="regal-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#1a1a1a]/40 tracking-wider">{stat.label}</p>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points by House */}
        <div className="regal-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-1" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
            Points by House
          </h3>
          <p className="text-xs text-[#1a1a1a]/40 mb-6">Distribution across all houses</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={houseChartData} margin={{ left: 10, right: 10, top: 30, bottom: 30 }} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#eee7d6" />
                <XAxis
                  dataKey="name"
                  tickFormatter={(value: string) => value.replace('House of ', '')}
                  tick={{ fontSize: 12, fill: '#1a1a1a' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11, fill: '#1a1a1a' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [
                    typeof value === 'number' ? value.toLocaleString() : `${value ?? 0}`,
                    'Points',
                  ]}
                />
                <Bar dataKey="points" shape={ShieldBar}>
                  {houseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="points" content={renderTopLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Points by Category */}
        <div className="regal-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-1" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
            Points by Category
          </h3>
          <p className="text-xs text-[#1a1a1a]/40 mb-6">Breakdown by merit categories</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ left: 10, right: 10, top: 30, bottom: 30 }} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#eee7d6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#1a1a1a' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11, fill: '#1a1a1a' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [
                    typeof value === 'number' ? value.toLocaleString() : `${value ?? 0}`,
                    'Points',
                  ]}
                />
                <Bar dataKey="points" shape={ShieldBar}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="points" content={renderTopLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </div>
    </RequireStaff>
  )
}
