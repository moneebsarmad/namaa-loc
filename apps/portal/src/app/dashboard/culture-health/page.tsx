'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../providers'
import CrestLoader from '../../../components/CrestLoader'
import { RequireStaff, AccessDenied } from '../../../components/PermissionGate'

interface DomainData {
  id: number
  domain_key: string
  display_name: string
  color: string
}

interface DomainHealth {
  id: number
  domain_key: string
  display_name: string
  color: string
  currentPoints: number
  previousPoints: number
  trend: 'up' | 'down' | 'stable'
  percentage: number
}

interface MeritEntry {
  domain_id: number | null
  points: number
  timestamp: string
}

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

type DateRange = {
  start: Date
  end: Date
}

function getAcademicWeek(): number {
  const now = new Date()
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const academicStart = new Date(year, 7, 15) // Aug 15
  const diffTime = now.getTime() - academicStart.getTime()
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1
  return Math.max(1, diffWeeks)
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function getPresetDateRange(preset: Exclude<DatePreset, 'custom'>): DateRange {
  const now = new Date()
  switch (preset) {
    case 'this_week':
      return { start: getStartOfWeek(now), end: getEndOfWeek(now) }
    case 'last_week': {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { start: getStartOfWeek(lastWeek), end: getEndOfWeek(lastWeek) }
    }
    case 'this_month':
      return { start: getStartOfMonth(now), end: getEndOfMonth(now) }
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: getStartOfMonth(lastMonth), end: getEndOfMonth(lastMonth) }
    }
  }
}

function getCustomDateRange(startValue: string, endValue: string): DateRange | null {
  if (!startValue || !endValue) return null

  const start = new Date(`${startValue}T00:00:00`)
  const end = new Date(`${endValue}T23:59:59.999`)

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    return null
  }

  return { start, end }
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}

export default function CultureHealthPage() {
  const { user } = useAuth()
  const currentSchoolId = user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null
  const [domains, setDomains] = useState<DomainData[]>([])
  const [domainHealth, setDomainHealth] = useState<DomainHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState<DatePreset>('this_week')
  const [appliedDatePreset, setAppliedDatePreset] = useState<DatePreset>('this_week')
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetDateRange('this_week'))
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const fetchIdRef = useRef(0)

  const fetchData = useCallback(async () => {
    if (!currentSchoolId) {
      setDomains([])
      setDomainHealth([])
      setLoading(false)
      return
    }
    const fetchId = fetchIdRef.current + 1
    fetchIdRef.current = fetchId
    setLoading(true)
    try {
      // Fetch domains
      const { data: domainsData } = await supabase
        .from('merit_domains')
        .select('*')
        .eq('is_active', true)
        .order('display_order')

      const allDomains: DomainData[] = (domainsData || []).map((d) => ({
        id: d.id,
        domain_key: d.domain_key || '',
        display_name: d.display_name || '',
        color: d.color || '#2D5016',
      }))

      // Calculate comparison period (same length before the selected range)
      const rangeDuration = dateRange.end.getTime() - dateRange.start.getTime()
      const previousStart = new Date(dateRange.start.getTime() - rangeDuration)
      const previousEnd = new Date(dateRange.start.getTime() - 1)

      // Fetch merit_log entries for both current and previous periods
      const { data: meritData } = await supabase
        .from('merit_log')
        .select('domain_id, points, timestamp')
        .eq('school_id', currentSchoolId)
        .gte('timestamp', previousStart.toISOString())
        .lte('timestamp', dateRange.end.toISOString())

      const entries: MeritEntry[] = (meritData || []).map((m) => ({
        domain_id: m.domain_id,
        points: m.points || 0,
        timestamp: m.timestamp || '',
      }))

      // Calculate health metrics per domain
      const healthData: DomainHealth[] = allDomains.map((domain) => {
        const domainEntries = entries.filter((e) => e.domain_id === domain.id)

        const currentPoints = domainEntries
          .filter((e) => {
            const ts = new Date(e.timestamp)
            return ts >= dateRange.start && ts <= dateRange.end
          })
          .reduce((sum, e) => sum + e.points, 0)

        const previousPoints = domainEntries
          .filter((e) => {
            const ts = new Date(e.timestamp)
            return ts >= previousStart && ts <= previousEnd
          })
          .reduce((sum, e) => sum + e.points, 0)

        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (currentPoints > previousPoints * 1.1) {
          trend = 'up'
        } else if (currentPoints < previousPoints * 0.9) {
          trend = 'down'
        }

        return {
          ...domain,
          currentPoints,
          previousPoints,
          trend,
          percentage: 0, // Will be calculated after we have all totals
        }
      })

      // Calculate percentages based on total points across all domains
      const totalCurrentPoints = healthData.reduce((sum, d) => sum + d.currentPoints, 0)

      const healthWithPercentages = healthData.map((d) => ({
        ...d,
        percentage: totalCurrentPoints > 0
          ? Math.round((d.currentPoints / totalCurrentPoints) * 100)
          : 20, // Equal distribution if no points
      }))

      if (fetchId === fetchIdRef.current) {
        setDomains(allDomains)
        setDomainHealth(healthWithPercentages)
      }
    } catch (error) {
      console.error('Error fetching culture health data:', error)
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [currentSchoolId, dateRange])

  // Real-time subscription
  useEffect(() => {
    if (!currentSchoolId) return
    const channel = supabase
      .channel('culture-health-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merit_log', filter: `school_id=eq.${currentSchoolId}` },
        () => {
          void fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchoolId, fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const applyCustomRangeIfComplete = (startValue: string, endValue: string) => {
    const range = getCustomDateRange(startValue, endValue)
    if (!range) return

    setAppliedDatePreset('custom')
    setDateRange(range)
  }

  const handlePresetClick = (preset: DatePreset) => {
    setDatePreset(preset)

    if (preset === 'custom') {
      setShowDatePicker(true)
      return
    }

    setShowDatePicker(false)
    setAppliedDatePreset(preset)
    setDateRange(getPresetDateRange(preset))
  }

  const handleCustomStartDateChange = (value: string) => {
    setCustomStartDate(value)
    applyCustomRangeIfComplete(value, customEndDate)
  }

  const handleCustomEndDateChange = (value: string) => {
    setCustomEndDate(value)
    applyCustomRangeIfComplete(customStartDate, value)
  }

  const overallHealth = useMemo(() => {
    if (domainHealth.length === 0) return 0
    // Calculate overall health based on whether all domains have activity
    const activeDomainsCount = domainHealth.filter((d) => d.currentPoints > 0).length
    const totalDomains = domainHealth.length
    const activityScore = totalDomains > 0 ? Math.round((activeDomainsCount / totalDomains) * 100) : 0

    // Factor in trends
    const upTrends = domainHealth.filter((d) => d.trend === 'up').length
    const downTrends = domainHealth.filter((d) => d.trend === 'down').length
    const trendBonus = (upTrends - downTrends) * 5

    return Math.max(0, Math.min(100, activityScore + trendBonus))
  }, [domainHealth])

  const actionableInsight = useMemo(() => {
    if (domainHealth.length === 0) return null

    const lowestDomain = [...domainHealth].sort((a, b) => a.percentage - b.percentage)[0]
    const decliningDomains = domainHealth.filter((d) => d.trend === 'down')

    if (decliningDomains.length > 0) {
      const declining = decliningDomains[0]
      const changePercent = declining.previousPoints > 0
        ? Math.round(((declining.previousPoints - declining.currentPoints) / declining.previousPoints) * 100)
        : 0
      return {
        domain: declining.display_name,
        message: `${declining.display_name} shows a ${changePercent}% decline this week. Consider focusing recognition efforts in this area.`,
      }
    }

    if (lowestDomain && lowestDomain.percentage < 15) {
      return {
        domain: lowestDomain.display_name,
        message: `${lowestDomain.display_name} has the lowest recognition activity. Consider proactive intervention before issues arise.`,
      }
    }

    return null
  }, [domainHealth])

  const weekNumber = getAcademicWeek()

  if (loading && domains.length === 0) {
    return <CrestLoader label="Loading culture health..." />
  }

  const presetLabels: Record<DatePreset, string> = {
    this_week: 'This Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    custom: 'Custom Range',
  }

  return (
    <RequireStaff fallback={<AccessDenied message="Admin access required to view Culture Health Dashboard." />}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1a1a1a] mb-1" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Culture Health Dashboard
            </h1>
            <p className="text-[#1a1a1a]/50 text-sm">
              {appliedDatePreset === 'this_week' ? `Week ${weekNumber}` : presetLabels[appliedDatePreset]} - {formatDateRange(dateRange.start, dateRange.end)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-[#2D5016]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              {overallHealth}%
            </p>
            <p className="text-sm text-[#1a1a1a]/50">Overall Health</p>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {(['this_week', 'last_week', 'this_month', 'last_month', 'custom'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  datePreset === preset
                    ? 'bg-[#2D5016] text-white'
                    : 'bg-gray-100 text-[#1a1a1a]/70 hover:bg-gray-200'
                }`}
              >
                {presetLabels[preset]}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {showDatePicker && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-[#1a1a1a]/50">From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="px-3 py-2 border border-[#1a1a1a]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#2D5016]/30 focus:border-[#2D5016] outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-[#1a1a1a]/50">To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="px-3 py-2 border border-[#1a1a1a]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#2D5016]/30 focus:border-[#2D5016] outline-none"
                />
              </div>
            </div>
          )}
          {loading && domains.length > 0 && (
            <p className="mt-3 text-xs text-[#1a1a1a]/40">Updating...</p>
          )}
        </div>

        {/* Domain Health Cards */}
        <div className="space-y-4 mb-6">
          {domainHealth.map((domain) => (
            <div
              key={domain.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#1a1a1a]">{domain.display_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1a1a1a]">{domain.percentage}%</span>
                  <span className={`text-lg ${
                    domain.trend === 'up' ? 'text-green-600' :
                    domain.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {domain.trend === 'up' ? '↑' : domain.trend === 'down' ? '↓' : '→'}
                  </span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${domain.percentage}%`,
                    backgroundColor: domain.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actionable Insight */}
        {actionableInsight && (
          <div className="bg-[#B8860B]/10 border border-[#B8860B]/20 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#B8860B]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#8b6508]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#1a1a1a] mb-1">Actionable Insight</p>
                <p className="text-sm text-[#1a1a1a]/70">
                  <span className="text-[#B8860B] font-medium">{actionableInsight.domain}</span>
                  {' '}{actionableInsight.message.replace(actionableInsight.domain, '').trim()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No insights message */}
        {!actionableInsight && domainHealth.length > 0 && (
          <div className="bg-[#055437]/10 border border-[#055437]/20 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#055437]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#055437]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#1a1a1a] mb-1">All Domains Healthy</p>
                <p className="text-sm text-[#1a1a1a]/70">
                  Recognition activity is balanced across all domains. Keep up the great work!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireStaff>
  )
}
