'use client'

import { useEffect, useMemo, useState } from 'react'
import { AccessDenied, RequireSuperAdmin } from '@/components/PermissionGate'

const PRESETS = [
  { id: 'thisCycle', label: 'This Cycle' },
  { id: 'last14', label: 'Last 14 Days' },
  { id: 'last30', label: 'Last 30 Days' },
]

const STATUS_STYLES = {
  Green: 'bg-[#055437]/10 text-[#055437]',
  Yellow: 'bg-[#B8860B]/15 text-[#8b6508]',
  Red: 'bg-[#910000]/10 text-[#910000]',
}

type OutcomeStatus = 'Green' | 'Yellow' | 'Red'

type MetricsPayload = {
  metrics: {
    outcomeA: { participationRate: number | null; avgActiveDays: number }
    outcomeB: { huddlesCount: number; coverageGap: number | null }
    outcomeC: { otherNotesCompliance: number | null; rosterIssuesCount: number }
    outcomeD: { decisionsCount: number; overdueActionsCount: number }
  }
  statuses: {
    outcomeA: { participationRate: OutcomeStatus; avgActiveDays: OutcomeStatus }
    outcomeB: { huddles: OutcomeStatus; coverageGap: OutcomeStatus }
    outcomeC: { otherNotes: OutcomeStatus; rosterIssues: OutcomeStatus }
    outcomeD: { decisions: OutcomeStatus; overdue: OutcomeStatus }
  }
  outcomeStatus: {
    outcomeA: OutcomeStatus
    outcomeB: OutcomeStatus
    outcomeC: OutcomeStatus
    outcomeD: OutcomeStatus
  }
  recommendedActions: {
    outcomeA: string | null
    outcomeB: string | null
    outcomeC: string | null
    outcomeD: string | null
  }
}

type RosterDetails = {
  unknownStaffEntries: Array<{ staff_name: string; student_name: string; date: string }>
  missingHouse: Array<{ staff_name: string; email: string }>
  missingGrade: Array<{ staff_name: string; email: string }>
}

type OtherMissingNotes = {
  entries: Array<{ date: string; staff_name: string; student_name: string; category: string; subcategory: string; notes: string }>
}

type ActionMenuItem = { id: string; title: string }

type DecisionFormState = {
  owner: string
  due_date: string
  action_type: string
  outcome_tag: string
  title: string
  notes: string
}

function toLocalDateString(date: Date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="w-28 h-2 bg-[#e5e2db] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: '#B8860B' }} />
    </div>
  )
}

function DotStrip({ filled }: { filled: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 4 }).map((_, idx) => (
        <span
          key={idx}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: idx < filled ? '#B8860B' : '#e5e2db' }}
        />
      ))}
    </div>
  )
}

export default function ImplementationHealthPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [preset, setPreset] = useState('thisCycle')
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rosterModalOpen, setRosterModalOpen] = useState(false)
  const [otherModalOpen, setOtherModalOpen] = useState(false)
  const [rosterDetails, setRosterDetails] = useState<RosterDetails | null>(null)
  const [otherDetails, setOtherDetails] = useState<OtherMissingNotes | null>(null)
  const [actionMenu, setActionMenu] = useState<ActionMenuItem[]>([])
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [decisionForm, setDecisionForm] = useState<DecisionFormState>({
    owner: '',
    due_date: '',
    action_type: '',
    outcome_tag: '',
    title: '',
    notes: '',
  })
  const [decisionSaving, setDecisionSaving] = useState(false)
  const [huddleSaving, setHuddleSaving] = useState(false)

  useEffect(() => {
    const today = toLocalDateString(new Date())
    const end = new Date(`${today}T00:00:00`)
    if (preset === 'last30') {
      setEndDate(today)
      setStartDate(toLocalDateString(addDays(end, -29)))
      return
    }
    setEndDate(today)
    setStartDate(toLocalDateString(addDays(end, -13)))
  }, [preset])

  useEffect(() => {
    if (!startDate || !endDate) return
    fetchMetrics()
  }, [startDate, endDate])

  useEffect(() => {
    fetchActionMenu()
  }, [])

  const fetchActionMenu = async () => {
    try {
      const response = await fetch('/api/implementation-health?actionMenu=1')
      const data = await response.json()
      if (Array.isArray(data.menu)) {
        setActionMenu(data.menu)
      }
    } catch {
      setActionMenu([])
    }
  }

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/implementation-health?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        setMetrics(null)
        return
      }
      setMetrics(data as MetricsPayload)
    } catch {
      setMetrics(null)
    } finally {
      setIsLoading(false)
    }
  }

  const openRosterModal = async () => {
    setRosterModalOpen(true)
    if (rosterDetails) return
    const params = new URLSearchParams({ startDate, endDate, detail: 'roster' })
    const response = await fetch(`/api/implementation-health?${params.toString()}`)
    const data = await response.json()
    if (response.ok) setRosterDetails(data)
  }

  const openOtherModal = async () => {
    setOtherModalOpen(true)
    if (otherDetails) return
    const params = new URLSearchParams({ startDate, endDate, detail: 'other-missing-notes' })
    const response = await fetch(`/api/implementation-health?${params.toString()}`)
    const data = await response.json()
    if (response.ok) setOtherDetails(data)
  }

  const handleExportCsv = () => {
    if (!metrics) return
    const rows = [
      ['Metric', 'Value', 'Status', 'Period Start', 'Period End', 'Generated At'],
      ['Participation Rate', formatPercent(metrics.metrics.outcomeA.participationRate), metrics.statuses.outcomeA.participationRate, startDate, endDate, toLocalDateString(new Date())],
      ['Avg Active Days', formatNumber(metrics.metrics.outcomeA.avgActiveDays), metrics.statuses.outcomeA.avgActiveDays, startDate, endDate, toLocalDateString(new Date())],
      ['Huddles (Last 4)', `${metrics.metrics.outcomeB.huddlesCount}/4`, metrics.statuses.outcomeB.huddles, startDate, endDate, toLocalDateString(new Date())],
      ['Coverage Gap', formatPercent(metrics.metrics.outcomeB.coverageGap), metrics.statuses.outcomeB.coverageGap, startDate, endDate, toLocalDateString(new Date())],
      ['Other Notes Compliance', formatPercent(metrics.metrics.outcomeC.otherNotesCompliance), metrics.statuses.outcomeC.otherNotes, startDate, endDate, toLocalDateString(new Date())],
      ['Roster Issues', String(metrics.metrics.outcomeC.rosterIssuesCount), metrics.statuses.outcomeC.rosterIssues, startDate, endDate, toLocalDateString(new Date())],
      ['Decisions Logged (Last 4)', `${metrics.metrics.outcomeD.decisionsCount}/4`, metrics.statuses.outcomeD.decisions, startDate, endDate, toLocalDateString(new Date())],
      ['Overdue Actions', String(metrics.metrics.outcomeD.overdueActionsCount), metrics.statuses.outcomeD.overdue, startDate, endDate, toLocalDateString(new Date())],
    ]

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `implementation_health_${startDate}_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = () => {
    if (!metrics) return
    const html = `
      <html>
      <head>
        <style>
          body { font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; padding: 24px; }
          h1 { margin-bottom: 6px; }
          .sub { color: rgba(26,26,46,0.6); margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .card { border: 1px solid rgba(201,162,39,0.2); border-radius: 14px; padding: 16px; }
          .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
          .metric { display: flex; justify-content: space-between; margin-top: 12px; }
          .label { color: rgba(26,26,46,0.6); font-size: 12px; }
          .value { font-size: 20px; font-weight: 600; }
          .action { margin-top: 10px; font-size: 12px; color: #910000; }
        </style>
      </head>
      <body>
        <h1>Implementation Health Snapshot</h1>
        <div class="sub">Period: ${startDate} → ${endDate}</div>
        <div class="grid">
          ${['A','B','C','D'].map((key) => {
            const outcomeKey = `outcome${key}` as keyof MetricsPayload['metrics']
            const status = metrics.outcomeStatus[outcomeKey]
            const action = metrics.recommendedActions[outcomeKey]
            const title = {
              A: 'Outcome A — Adoption',
              B: 'Outcome B — Consistency',
              C: 'Outcome C — Governance',
              D: 'Outcome D — Insight & Action'
            }[key] || []
            const rows = {
              A: [
                ['Participation Rate', formatPercent(metrics.metrics.outcomeA.participationRate)],
                ['Avg Active Days', formatNumber(metrics.metrics.outcomeA.avgActiveDays)],
              ],
              B: [
                ['Huddles (Last 4)', `${metrics.metrics.outcomeB.huddlesCount}/4`],
                ['Coverage Gap', formatPercent(metrics.metrics.outcomeB.coverageGap)],
              ],
              C: [
                ['Other Notes Compliance', formatPercent(metrics.metrics.outcomeC.otherNotesCompliance)],
                ['Roster Issues', String(metrics.metrics.outcomeC.rosterIssuesCount)],
              ],
              D: [
                ['Decisions Logged (Last 4)', `${metrics.metrics.outcomeD.decisionsCount}/4`],
                ['Overdue Actions', String(metrics.metrics.outcomeD.overdueActionsCount)],
              ],
            }[key]
            const safeRows = rows ?? []
            return `
              <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong>${title}</strong>
                  <span class="pill" style="background:${status === 'Green' ? 'rgba(5,84,55,0.1)' : status === 'Yellow' ? 'rgba(201,162,39,0.15)' : 'rgba(145,0,0,0.1)'}; color:${status === 'Green' ? '#055437' : status === 'Yellow' ? '#8b6508' : '#910000'};">${status}</span>
                </div>
                ${safeRows.map((row) => `
                  <div class="metric">
                    <div class="label">${row[0]}</div>
                    <div class="value">${row[1]}</div>
                  </div>
                `).join('')}
                ${action ? `<div class="action">${action}</div>` : ''}
              </div>
            `
          }).join('')}
        </div>
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

  const handleLogHuddle = async () => {
    setHuddleSaving(true)
    const response = await fetch('/api/implementation-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'huddle', cycle_end_date: endDate }),
    })
    if (response.ok) {
      fetchMetrics()
    }
    setHuddleSaving(false)
  }

  const handleDecisionSave = async () => {
    setDecisionSaving(true)
    const response = await fetch('/api/implementation-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'decision',
        cycle_end_date: endDate,
        owner: decisionForm.owner,
        due_date: decisionForm.due_date,
        action_type: decisionForm.action_type,
        outcome_tag: decisionForm.outcome_tag || null,
        title: decisionForm.title || null,
        notes: decisionForm.notes || null,
      }),
    })
    if (response.ok) {
      setDecisionModalOpen(false)
      setDecisionForm({ owner: '', due_date: '', action_type: '', outcome_tag: '', title: '', notes: '' })
      fetchMetrics()
    }
    setDecisionSaving(false)
  }

  const outcomeCards = useMemo(() => {
    const safeMetrics: MetricsPayload = metrics ?? {
      metrics: {
        outcomeA: { participationRate: null, avgActiveDays: 0 },
        outcomeB: { huddlesCount: 0, coverageGap: null },
        outcomeC: { otherNotesCompliance: null, rosterIssuesCount: 0 },
        outcomeD: { decisionsCount: 0, overdueActionsCount: 0 },
      },
      statuses: {
        outcomeA: { participationRate: 'Green', avgActiveDays: 'Green' },
        outcomeB: { huddles: 'Green', coverageGap: 'Green' },
        outcomeC: { otherNotes: 'Green', rosterIssues: 'Green' },
        outcomeD: { decisions: 'Green', overdue: 'Green' },
      },
      outcomeStatus: {
        outcomeA: 'Green',
        outcomeB: 'Green',
        outcomeC: 'Green',
        outcomeD: 'Green',
      },
      recommendedActions: {
        outcomeA: null,
        outcomeB: null,
        outcomeC: null,
        outcomeD: null,
      },
    }
    return [
      {
        id: 'A',
        title: 'Outcome A — Adoption',
        question: 'Are staff participating regularly?',
        status: safeMetrics.outcomeStatus.outcomeA,
        action: safeMetrics.recommendedActions.outcomeA,
        goFix: { label: 'Go Fix → Staff Engagement', href: '/dashboard/staff' },
        rows: [
          {
            label: 'Participation Rate',
            value: formatPercent(safeMetrics.metrics.outcomeA.participationRate),
            visual: <ProgressBar value={(safeMetrics.metrics.outcomeA.participationRate ?? 0) * 100} />,
            onClick: undefined,
          },
          {
            label: 'Avg Active Days',
            value: formatNumber(safeMetrics.metrics.outcomeA.avgActiveDays),
            visual: <span className="text-xs text-[#1a1a1a]/40">days</span>,
            onClick: undefined,
          },
        ],
      },
      {
        id: 'B',
        title: 'Outcome B — Consistency',
        question: 'Are we meeting and covering everyone?',
        status: safeMetrics.outcomeStatus.outcomeB,
        action: safeMetrics.recommendedActions.outcomeB,
        goFix: { label: 'Go Fix → Staff Engagement', href: '/dashboard/staff' },
        rows: [
          {
            label: 'Huddles (Last 4)',
            value: `${safeMetrics.metrics.outcomeB.huddlesCount}/4`,
            visual: <DotStrip filled={safeMetrics.metrics.outcomeB.huddlesCount} />,
            onClick: undefined,
          },
          {
            label: 'Coverage Gap',
            value: formatPercent(safeMetrics.metrics.outcomeB.coverageGap),
            visual: <ProgressBar value={(safeMetrics.metrics.outcomeB.coverageGap ?? 0) * 100} />,
            onClick: undefined,
          },
        ],
      },
      {
        id: 'C',
        title: 'Outcome C — Governance',
        question: 'Is data clean enough to trust?',
        status: safeMetrics.outcomeStatus.outcomeC,
        action: safeMetrics.recommendedActions.outcomeC,
        goFix: { label: 'Go Fix → Roster & Notes', onClick: openRosterModal },
        rows: [
          {
            label: 'Other Notes Compliance',
            value: formatPercent(safeMetrics.metrics.outcomeC.otherNotesCompliance),
            visual: <ProgressBar value={(safeMetrics.metrics.outcomeC.otherNotesCompliance ?? 0) * 100} />,
            onClick: openOtherModal,
          },
          {
            label: 'Roster Issues',
            value: String(safeMetrics.metrics.outcomeC.rosterIssuesCount),
            visual: (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#910000]/10 text-[#910000]">
                {safeMetrics.metrics.outcomeC.rosterIssuesCount} issues
              </span>
            ),
            onClick: undefined,
          },
        ],
      },
      {
        id: 'D',
        title: 'Outcome D — Insight & Action',
        question: 'Are decisions turning into action?',
        status: safeMetrics.outcomeStatus.outcomeD,
        action: safeMetrics.recommendedActions.outcomeD,
        goFix: { label: 'Go Fix → Decision Log', href: '#decision-log' },
        rows: [
          {
            label: 'Decisions Logged (Last 4)',
            value: `${safeMetrics.metrics.outcomeD.decisionsCount}/4`,
            visual: <DotStrip filled={safeMetrics.metrics.outcomeD.decisionsCount} />,
            onClick: undefined,
          },
          {
            label: 'Overdue Actions',
            value: String(safeMetrics.metrics.outcomeD.overdueActionsCount),
            visual: (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#B8860B]/15 text-[#8b6508]">
                {safeMetrics.metrics.outcomeD.overdueActionsCount} overdue
              </span>
            ),
            onClick: undefined,
          },
        ],
      },
    ]
  }, [metrics])

  return (
    <RequireSuperAdmin fallback={<AccessDenied message="Super-admin access required." />}>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Poppins, sans-serif' }}>
          Implementation Health Snapshot
        </h1>
        <p className="text-[#1a1a1a]/50 text-sm font-medium">Are we using it? Is it consistent? Is data clean? Are we taking action?</p>
        {isLoading && (
          <p className="text-xs text-[#1a1a1a]/40 mt-2">Loading metrics...</p>
        )}
      </div>

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
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleExportPdf}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white"
          >
            Export PDF
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#B8860B]/15 text-[#8b6508]"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {outcomeCards.map((card) => (
          <div key={card.id} className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1a1a1a]">{card.title}</h2>
                <p className="text-xs text-[#1a1a1a]/40">{card.question}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[card.status]}`}>
                {card.status}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {card.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#1a1a1a]/40">{row.label}</p>
                    <p className="text-2xl font-semibold text-[#1a1a1a]">{row.value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.visual}
                    {row.onClick && (
                      <button
                        onClick={row.onClick}
                        className="text-xs text-[#B8860B] hover:text-[#8b6508]"
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {card.status === 'Red' && card.action && (
              <div className="mt-4 bg-[#910000]/10 text-[#910000] text-xs rounded-xl px-3 py-2">
                If Red: {card.action}
              </div>
            )}

            <div className="mt-4 text-xs font-semibold">
              {'href' in card.goFix ? (
                <a href={card.goFix.href} className="text-[#B8860B] hover:text-[#8b6508]">
                  {card.goFix.label}
                </a>
              ) : (
                <button onClick={card.goFix.onClick} className="text-[#B8860B] hover:text-[#8b6508]">
                  {card.goFix.label}
                </button>
              )}
            </div>

            {card.id === 'B' && (
              <div className="mt-4">
                <button
                  onClick={handleLogHuddle}
                  disabled={huddleSaving}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#2D5016] text-white disabled:opacity-50"
                >
                  {huddleSaving ? 'Logging...' : 'Log Huddle'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div id="decision-log" className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Decision Log</h2>
            <p className="text-xs text-[#1a1a1a]/40">Capture owners and due dates for follow-through</p>
          </div>
          <button
            onClick={() => setDecisionModalOpen(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white"
          >
            Log Decision
          </button>
        </div>
      </div>

      {rosterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 p-6">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl">
            <div className="p-6 border-b border-[#B8860B]/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Roster Issues</h3>
                <p className="text-xs text-[#1a1a1a]/40">Unknown staff and missing mappings</p>
              </div>
              <button onClick={() => setRosterModalOpen(false)} className="text-sm text-[#1a1a1a]/50">Close</button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a]">Unknown staff entries</h4>
                {(rosterDetails?.unknownStaffEntries.length || 0) === 0 ? (
                  <p className="text-xs text-[#1a1a1a]/40">None</p>
                ) : (
                  <div className="mt-2 space-y-2 text-xs">
                    {rosterDetails?.unknownStaffEntries.map((row, idx) => (
                      <div key={`${row.staff_name}-${idx}`} className="flex justify-between">
                        <span>{row.staff_name}</span>
                        <span className="text-[#1a1a1a]/40">{row.student_name} • {row.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a]">Missing house</h4>
                {(rosterDetails?.missingHouse.length || 0) === 0 ? (
                  <p className="text-xs text-[#1a1a1a]/40">None</p>
                ) : (
                  <div className="mt-2 space-y-2 text-xs">
                    {rosterDetails?.missingHouse.map((row, idx) => (
                      <div key={`${row.staff_name}-${idx}`} className="flex justify-between">
                        <span>{row.staff_name}</span>
                        <span className="text-[#1a1a1a]/40">{row.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a]">Missing grade/department</h4>
                {(rosterDetails?.missingGrade.length || 0) === 0 ? (
                  <p className="text-xs text-[#1a1a1a]/40">None</p>
                ) : (
                  <div className="mt-2 space-y-2 text-xs">
                    {rosterDetails?.missingGrade.map((row, idx) => (
                      <div key={`${row.staff_name}-${idx}`} className="flex justify-between">
                        <span>{row.staff_name}</span>
                        <span className="text-[#1a1a1a]/40">{row.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {otherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 p-6">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl">
            <div className="p-6 border-b border-[#B8860B]/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Other Without Notes</h3>
                <p className="text-xs text-[#1a1a1a]/40">Entries missing required notes</p>
              </div>
              <button onClick={() => setOtherModalOpen(false)} className="text-sm text-[#1a1a1a]/50">Close</button>
            </div>
            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {(otherDetails?.entries.length || 0) === 0 ? (
                <p className="text-xs text-[#1a1a1a]/40">No missing notes in this period.</p>
              ) : (
                otherDetails?.entries.map((entry, idx) => (
                  <div key={`${entry.staff_name}-${idx}`} className="border border-[#1a1a1a]/10 rounded-xl p-4 text-xs">
                    <div className="flex justify-between text-[#1a1a1a]/60">
                      <span>{entry.date}</span>
                      <span>{entry.staff_name}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#1a1a1a] mt-2">{entry.student_name}</p>
                    <p className="text-[#1a1a1a]/50">{entry.category} • {entry.subcategory}</p>
                    {entry.notes && <p className="text-[#1a1a1a]/50 mt-1">Notes: {entry.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {decisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
            <div className="p-6 border-b border-[#B8860B]/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Log Decision</h3>
                <p className="text-xs text-[#1a1a1a]/40">Owner + due date required</p>
              </div>
              <button onClick={() => setDecisionModalOpen(false)} className="text-sm text-[#1a1a1a]/50">Close</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <label className="flex flex-col gap-1">
                Owner
                <input
                  value={decisionForm.owner}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, owner: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                />
              </label>
              <label className="flex flex-col gap-1">
                Due Date
                <input
                  type="date"
                  value={decisionForm.due_date}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                />
              </label>
              <label className="flex flex-col gap-1">
                Action Type
                <select
                  value={decisionForm.action_type}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, action_type: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                >
                  <option value="">Select action</option>
                  {actionMenu.map((item) => (
                    <option key={item.id} value={item.title}>{item.title}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Outcome Tag
                <select
                  value={decisionForm.outcome_tag}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, outcome_tag: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                >
                  <option value="">Optional</option>
                  <option value="A">Outcome A</option>
                  <option value="B">Outcome B</option>
                  <option value="C">Outcome C</option>
                  <option value="D">Outcome D</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                Title
                <input
                  value={decisionForm.title}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                Notes
                <textarea
                  value={decisionForm.notes}
                  onChange={(e) => setDecisionForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#1a1a1a]/10"
                  rows={3}
                />
              </label>
            </div>
            <div className="p-6 border-t border-[#B8860B]/10 flex justify-end gap-3">
              <button
                onClick={handleDecisionSave}
                disabled={decisionSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white disabled:opacity-50"
              >
                {decisionSaving ? 'Saving...' : 'Save Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </RequireSuperAdmin>
  )
}
