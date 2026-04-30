'use client'

import { useEffect, useState, useCallback } from 'react'
import { AccessDenied, RequireRole } from '@/components/PermissionGate'
import { ROLES } from '@/lib/permissions'

type HealthStatus = 'GREEN' | 'AMBER' | 'RED'

type Alert = {
  id: string
  alert_type: string
  severity: 'AMBER' | 'RED'
  title: string
  message: string
  recommended_action: string | null
  status: string
  created_at: string
}

type HealthOverview = {
  health: {
    score: number
    status: HealthStatus
    participationScore: number
    categoryBalanceScore: number
    houseBalanceScore: number
    consistencyScore: number
  }
  metrics: {
    participation: {
      rate: number | null
      activeStaff: number
      totalStaff: number
      inactiveStaff: string[]
    }
    pointEconomy: {
      totalPoints: number
      totalTransactions: number
      pointsPerStudent: number | null
      pointsPerStaff: number | null
      avgPerTransaction: number | null
    }
    categoryBalance: {
      distribution: Record<string, number>
      percentages: Record<string, number>
      dominantCategory: string | null
      isBalanced: boolean
    }
    houseDistribution: {
      points: Record<string, number>
      percentages: Record<string, number>
      variance: number
      isBalanced: boolean
    }
  }
  alerts: {
    activeCount: number
    redCount: number
    amberCount: number
    recentAlerts: Alert[]
  }
  period: {
    startDate: string
    endDate: string
  }
}

const STATUS_COLORS: Record<HealthStatus, { bg: string; text: string; border: string }> = {
  GREEN: { bg: 'bg-[#055437]/10', text: 'text-[#055437]', border: 'border-[#055437]/30' },
  AMBER: { bg: 'bg-[#B8860B]/15', text: 'text-[#8b6508]', border: 'border-[#B8860B]/30' },
  RED: { bg: 'bg-[#910000]/10', text: 'text-[#910000]', border: 'border-[#910000]/30' },
}

const PRESETS = [
  { id: 'last7', label: 'Last 7 Days', days: 7 },
  { id: 'last14', label: 'Last 14 Days', days: 14 },
  { id: 'last30', label: 'Last 30 Days', days: 30 },
]

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

function formatNumber(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(decimals)
}

function HealthScoreGauge({ score, status }: { score: number; status: HealthStatus }) {
  const colors = STATUS_COLORS[status]
  const circumference = 2 * Math.PI * 45
  const progress = (score / 100) * circumference

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e2db" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={status === 'GREEN' ? '#055437' : status === 'AMBER' ? '#B8860B' : '#910000'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
        <span className="text-xs text-[#1a1a1a]/50">/ 100</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const colors = STATUS_COLORS[status]
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {status}
    </span>
  )
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#1a1a1a]/60">{label}</span>
        <span className="font-semibold">{score}</span>
      </div>
      <div className="w-full h-2 bg-[#e5e2db] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function AlertCard({ alert, onAcknowledge }: { alert: Alert; onAcknowledge: (id: string) => void }) {
  const isRed = alert.severity === 'RED'
  return (
    <div
      className={`p-4 rounded-xl border ${
        isRed ? 'bg-[#910000]/5 border-[#910000]/20' : 'bg-[#B8860B]/5 border-[#B8860B]/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                isRed ? 'bg-[#910000]/10 text-[#910000]' : 'bg-[#B8860B]/15 text-[#8b6508]'
              }`}
            >
              {alert.severity}
            </span>
            <span className="text-xs text-[#1a1a1a]/40">
              {new Date(alert.created_at).toLocaleDateString()}
            </span>
          </div>
          <h4 className="font-semibold text-[#1a1a1a] mt-1">{alert.title}</h4>
          <p className="text-sm text-[#1a1a1a]/60 mt-1">{alert.message}</p>
          {alert.recommended_action && (
            <p className="text-xs text-[#1a1a1a]/50 mt-2 italic">
              Recommended: {alert.recommended_action}
            </p>
          )}
        </div>
        {alert.status === 'ACTIVE' && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1a1a1a] text-white hover:bg-[#1a1a1a]/80"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-[#B8860B]/10">
      <p className="text-xs text-[#1a1a1a]/50 uppercase tracking-wide">{title}</p>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-bold text-[#1a1a1a]">{value}</span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend === 'up' ? 'text-[#055437]' : trend === 'down' ? 'text-[#910000]' : 'text-[#1a1a1a]/40'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-[#1a1a1a]/40 mt-1">{subtitle}</p>}
    </div>
  )
}

function CategoryDistributionChart({ percentages }: { percentages: Record<string, number> }) {
  const categories = ['Respect', 'Responsibility', 'Righteousness', 'Other']
  const colors = ['#055437', '#2f0a61', '#000068', '#B8860B']

  return (
    <div className="space-y-3">
      {categories.map((cat, idx) => {
        const pct = percentages[cat] || 0
        return (
          <div key={cat} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#1a1a1a]/60">{cat}</span>
              <span className="font-semibold">{pct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-[#e5e2db] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: colors[idx] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HouseDistributionChart({ points }: { points: Record<string, number> }) {
  const total = Object.values(points).reduce((a, b) => a + b, 0)
  const colors: Record<string, string> = {
    'House of Abū Bakr': '#2f0a61',
    'House of Khadījah': '#055437',
    'House of ʿUmar': '#000068',
    'House of ʿĀʾishah': '#910000',
  }

  return (
    <div className="space-y-3">
      {Object.entries(points).map(([house, pts]) => {
        const pct = total > 0 ? (pts / total) * 100 : 0
        return (
          <div key={house} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#1a1a1a]/60">{house.replace('House of ', '')}</span>
              <span className="font-semibold">{pts.toLocaleString()} pts</span>
            </div>
            <div className="w-full h-2 bg-[#e5e2db] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: colors[house] || '#B8860B' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Tier2AnalyticsPage() {
  const [preset, setPreset] = useState('last7')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<HealthOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Set dates based on preset
  useEffect(() => {
    const today = new Date()
    const presetConfig = PRESETS.find((p) => p.id === preset)
    if (presetConfig) {
      setEndDate(toDateString(today))
      setStartDate(toDateString(addDays(today, -(presetConfig.days - 1))))
    }
  }, [preset])

  // Fetch data when dates change
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/analytics/health-overview?${params.toString()}`)

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      })

      if (response.ok) {
        fetchData() // Refresh data
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleCheckThresholds = async () => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', startDate, endDate }),
      })

      if (response.ok) {
        fetchData() // Refresh data
      }
    } catch (err) {
      console.error('Failed to check thresholds:', err)
    }
  }

  return (
    <RequireRole roles={ROLES.ADMIN} fallback={<AccessDenied message="Admin access required." />}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-3xl font-bold text-[#1a1a1a]"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            System Health Analytics
          </h1>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">
            Comprehensive health monitoring and alerts for your LOC implementation
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                onClick={() => setPreset(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                  preset === item.id
                    ? 'bg-[#B8860B] text-white border-[#B8860B]'
                    : 'bg-white text-[#1a1a1a]/60 border-[#1a1a1a]/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#1a1a1a]/40">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#1a1a1a]/40">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10 text-xs"
            />
          </div>
          <button
            onClick={handleCheckThresholds}
            className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white"
          >
            Check Thresholds
          </button>
        </div>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[#1a1a1a]/50">Loading analytics...</p>
          </div>
        )}

        {error && (
          <div className="bg-[#910000]/10 text-[#910000] rounded-xl p-4">
            <p className="font-semibold">Error loading analytics</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Main Content */}
        {data && !isLoading && (
          <>
            {/* Health Overview Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Health Score Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">Overall Health</h2>
                  <StatusBadge status={data.health.status} />
                </div>
                <div className="flex items-center justify-center mb-4">
                  <HealthScoreGauge score={data.health.score} status={data.health.status} />
                </div>
                <div className="space-y-3">
                  <ScoreBar
                    label="Participation"
                    score={data.health.participationScore}
                    color="#2f0a61"
                  />
                  <ScoreBar
                    label="Category Balance"
                    score={data.health.categoryBalanceScore}
                    color="#055437"
                  />
                  <ScoreBar
                    label="House Balance"
                    score={data.health.houseBalanceScore}
                    color="#000068"
                  />
                  <ScoreBar
                    label="Consistency"
                    score={data.health.consistencyScore}
                    color="#B8860B"
                  />
                </div>
              </div>

              {/* Key Metrics Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Key Metrics</h2>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    title="Participation"
                    value={formatPercent(data.metrics.participation.rate)}
                    subtitle={`${data.metrics.participation.activeStaff}/${data.metrics.participation.totalStaff} staff`}
                  />
                  <MetricCard
                    title="Total Points"
                    value={data.metrics.pointEconomy.totalPoints.toLocaleString()}
                    subtitle={`${data.metrics.pointEconomy.totalTransactions} transactions`}
                  />
                  <MetricCard
                    title="Pts/Student"
                    value={formatNumber(data.metrics.pointEconomy.pointsPerStudent)}
                  />
                  <MetricCard
                    title="Pts/Staff"
                    value={formatNumber(data.metrics.pointEconomy.pointsPerStaff)}
                  />
                </div>
              </div>

              {/* Alerts Summary Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">Active Alerts</h2>
                  <div className="flex items-center gap-2">
                    {data.alerts.redCount > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#910000]/10 text-[#910000]">
                        {data.alerts.redCount} RED
                      </span>
                    )}
                    {data.alerts.amberCount > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#B8860B]/15 text-[#8b6508]">
                        {data.alerts.amberCount} AMBER
                      </span>
                    )}
                  </div>
                </div>
                {data.alerts.activeCount === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#055437] font-semibold">All Clear!</p>
                    <p className="text-sm text-[#1a1a1a]/50 mt-1">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.alerts.recentAlerts.slice(0, 3).map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onAcknowledge={handleAcknowledgeAlert}
                      />
                    ))}
                    {data.alerts.activeCount > 3 && (
                      <p className="text-xs text-[#1a1a1a]/50 text-center">
                        +{data.alerts.activeCount - 3} more alerts
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Balance */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">Category Balance (3Rs)</h2>
                    <p className="text-xs text-[#1a1a1a]/50">
                      {data.metrics.categoryBalance.isBalanced ? 'Well balanced' : 'Needs attention'}
                    </p>
                  </div>
                  {data.metrics.categoryBalance.dominantCategory && (
                    <span className="px-2 py-1 rounded-lg text-xs bg-[#B8860B]/10 text-[#8b6508]">
                      Dominant: {data.metrics.categoryBalance.dominantCategory}
                    </span>
                  )}
                </div>
                <CategoryDistributionChart percentages={data.metrics.categoryBalance.percentages} />
              </div>

              {/* House Distribution */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">House Distribution</h2>
                    <p className="text-xs text-[#1a1a1a]/50">
                      Variance: {data.metrics.houseDistribution.variance.toFixed(1)}%
                    </p>
                  </div>
                  <StatusBadge
                    status={data.metrics.houseDistribution.isBalanced ? 'GREEN' : 'AMBER'}
                  />
                </div>
                <HouseDistributionChart points={data.metrics.houseDistribution.points} />
              </div>
            </div>

            {/* Inactive Staff Section */}
            {data.metrics.participation.inactiveStaff.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
                <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">
                  Inactive Staff ({data.metrics.participation.inactiveStaff.length})
                </h2>
                <p className="text-sm text-[#1a1a1a]/60 mb-4">
                  These staff members have not given any points during the selected period.
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.metrics.participation.inactiveStaff.slice(0, 20).map((name) => (
                    <span
                      key={name}
                      className="px-3 py-1 rounded-full text-xs bg-[#910000]/5 text-[#910000] border border-[#910000]/10"
                    >
                      {name}
                    </span>
                  ))}
                  {data.metrics.participation.inactiveStaff.length > 20 && (
                    <span className="px-3 py-1 rounded-full text-xs bg-[#1a1a1a]/5 text-[#1a1a1a]/60">
                      +{data.metrics.participation.inactiveStaff.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RequireRole>
  )
}
