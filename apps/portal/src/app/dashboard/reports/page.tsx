'use client'

import { useEffect, useState } from 'react'
import { useSessionStorageState } from '@/hooks/useSessionStorageState'
import { AccessDenied, RequireRole } from '@/components/PermissionGate'
import { ROLES } from '@/lib/permissions'
import { HOUSE_LOGOS, HOUSE_OPTIONS } from '@/lib/reportExport'

type ReportTemplate = {
  id: string
  title: string
  description: string
  format: 'CSV' | 'PDF' | 'BOTH'
  scope: 'All-time' | 'Current month'
}

type StudentSelection = {
  id?: string
  name: string
  grade: number
  section: string
  house: string
}

type ReportFilterPayload = {
  grades: number[]
  sectionsByGrade: Record<string, string[]>
}

const templates: ReportTemplate[] = [
  {
    id: 'all-time-summary',
    title: 'All-Time Merit Summary',
    description: 'Totals by house, grade, staff, and category.',
    format: 'BOTH',
    scope: 'All-time',
  },
  {
    id: 'house-snapshot',
    title: 'House Performance Snapshot',
    description: 'Totals by house with student and staff engagement.',
    format: 'BOTH',
    scope: 'All-time',
  },
  {
    id: 'grade-section-leaderboard',
    title: 'Grade & Section Leaderboard',
    description: 'Total points by grade and section.',
    format: 'BOTH',
    scope: 'All-time',
  },
  {
    id: 'category-report',
    title: 'Merit Category Report',
    description: 'Points by 3R categories and subcategories.',
    format: 'BOTH',
    scope: 'All-time',
  },
  {
    id: 'monthly-merit',
    title: 'Monthly Merit Log',
    description: 'All merit entries for the current month.',
    format: 'BOTH',
    scope: 'Current month',
  },
  {
    id: 'monthly-highlights',
    title: 'Monthly Highlights',
    description: 'Top students, staff, and houses this month.',
    format: 'BOTH',
    scope: 'Current month',
  },
  {
    id: 'leadership-summary',
    title: 'Leadership Summary',
    description: 'Four key charts for leadership review.',
    format: 'BOTH',
    scope: 'All-time',
  },
  {
    id: 'staff-recognition',
    title: 'Staff Recognition Report',
    description: 'Monthly staff awards and participation stats.',
    format: 'BOTH',
    scope: 'Current month',
  },
]

function parseFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback
  const match = contentDisposition.match(/filename="([^"]+)"/i)
  return match?.[1] || fallback
}

function formatStudentLabel(student: StudentSelection | null) {
  if (!student) return ''
  return `${student.name} (Grade ${student.grade}${student.section})`
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null)
    return data?.error || 'Failed to generate report.'
  }
  const text = await response.text().catch(() => '')
  return text || 'Failed to generate report.'
}

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [filtersLoading, setFiltersLoading] = useState(true)
  const [startDate, setStartDate] = useSessionStorageState('admin:reports:startDate', '')
  const [endDate, setEndDate] = useSessionStorageState('admin:reports:endDate', '')
  const [studentSearch, setStudentSearch] = useSessionStorageState('admin:reports:studentSearch', '')
  const [selectedStudent, setSelectedStudent] = useSessionStorageState<StudentSelection | null>(
    'admin:reports:selectedStudent',
    null
  )
  const [selectedHouse, setSelectedHouse] = useSessionStorageState('admin:reports:selectedHouse', '')
  const [selectedGrade, setSelectedGrade] = useSessionStorageState('admin:reports:selectedGrade', '')
  const [selectedSection, setSelectedSection] = useSessionStorageState('admin:reports:selectedSection', '')
  const [studentMatches, setStudentMatches] = useState<StudentSelection[]>([])
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)
  const [reportFilters, setReportFilters] = useState<ReportFilterPayload>({
    grades: [],
    sectionsByGrade: {},
  })

  useEffect(() => {
    let ignore = false

    const loadFilters = async () => {
      try {
        const response = await fetch('/api/reports/export', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(await readErrorMessage(response))
        }
        const data = (await response.json()) as ReportFilterPayload
        if (!ignore) {
          setReportFilters({
            grades: data.grades || [],
            sectionsByGrade: data.sectionsByGrade || {},
          })
        }
      } catch (error) {
        if (!ignore) {
          setReportError(error instanceof Error ? error.message : 'Failed to load report filters.')
        }
      } finally {
        if (!ignore) {
          setFiltersLoading(false)
        }
      }
    }

    loadFilters()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const trimmed = studentSearch.trim()
    const selectedLabel = formatStudentLabel(selectedStudent)

    if (!trimmed || trimmed.length < 2 || (selectedStudent && trimmed === selectedLabel)) {
      setStudentMatches([])
      setStudentSearchLoading(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setStudentSearchLoading(true)

      try {
        const response = await fetch(`/api/students/lookup?search=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(await readErrorMessage(response))
        }

        const data = await response.json()
        if (!controller.signal.aborted) {
          setStudentMatches(
            (data?.data || []).map((student: { id: string; student_name: string; grade: number; section: string; house: string }) => ({
              id: student.id,
              name: student.student_name,
              grade: student.grade,
              section: student.section,
              house: student.house,
            }))
          )
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setStudentMatches([])
          setReportError(error instanceof Error ? error.message : 'Failed to search students.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setStudentSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [studentSearch, selectedStudent])

  const hasCustomRange = Boolean(startDate || endDate)
  const customRangeLabel = `${startDate || '...'} to ${endDate || '...'}`
  const rangeBadgeLabel = hasCustomRange ? customRangeLabel : 'Default range'
  const selectedStudentHasId = Boolean(selectedStudent?.id)
  const gradeOptions = reportFilters.grades
  const sectionOptions = selectedGrade ? reportFilters.sectionsByGrade[selectedGrade] || [] : []
  const showStudentResults = studentSearch.trim().length >= 2 && (
    !selectedStudent || studentSearch.trim() !== formatStudentLabel(selectedStudent)
  )

  const triggerExport = async (
    exportId: string,
    format: 'CSV' | 'PDF',
    payload: Record<string, unknown>
  ) => {
    const popup = format === 'PDF' ? window.open('', '_blank') : null

    if (format === 'PDF' && !popup) {
      setReportError('Allow pop-ups in this browser to preview printable PDF reports.')
      return
    }

    setIsGenerating(`${exportId}-${format}`)
    setReportError(null)

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          format,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response)
        popup?.close()
        setReportError(message)
        return
      }

      const blob = await response.blob()
      const fallbackName = format === 'CSV' ? `${exportId}.csv` : `${exportId}.html`
      const filename = parseFilename(response.headers.get('Content-Disposition'), fallbackName)
      const objectUrl = URL.createObjectURL(blob)

      if (format === 'CSV') {
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
        return
      }

      if (popup) {
        popup.location.href = objectUrl
      } else {
        window.open(objectUrl, '_blank')
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error) {
      popup?.close()
      setReportError(error instanceof Error ? error.message : 'Failed to generate report.')
    } finally {
      setIsGenerating(null)
    }
  }

  const generateTemplateReport = async (templateId: string, format: 'CSV' | 'PDF') => {
    await triggerExport(templateId, format, { templateId })
  }

  const generateStudentReport = async (format: 'CSV' | 'PDF') => {
    if (!selectedStudentHasId || !selectedStudent) {
      setReportError('Select a student from the lookup list before generating a report.')
      return
    }

    await triggerExport('student', format, {
      templateId: 'student',
      student: selectedStudent,
    })
  }

  const generateHouseReport = async (format: 'CSV' | 'PDF') => {
    if (!selectedHouse) {
      setReportError('Select a house before generating a report.')
      return
    }

    await triggerExport('house', format, {
      templateId: 'house',
      house: selectedHouse,
    })
  }

  const generateGradeReport = async (format: 'CSV' | 'PDF') => {
    if (!selectedGrade) {
      setReportError('Select a grade before generating a report.')
      return
    }

    await triggerExport('grade', format, {
      templateId: 'grade',
      grade: selectedGrade,
    })
  }

  const generateSectionReport = async (format: 'CSV' | 'PDF') => {
    if (!selectedGrade || !selectedSection) {
      setReportError('Select both a grade and a section before generating a report.')
      return
    }

    await triggerExport('section', format, {
      templateId: 'section',
      grade: selectedGrade,
      section: selectedSection,
    })
  }

  return (
    <RequireRole roles={[ROLES.ADMIN]} fallback={<AccessDenied message="Admin access required." />}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Reports
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
            <p className="text-[#1a1a1a]/50 text-sm font-medium">
              Generate exports and printable summaries
            </p>
          </div>
        </div>

        {reportError && (
          <div className="mb-6 rounded-2xl border border-[#910000]/20 bg-[#910000]/5 px-4 py-3 text-sm text-[#910000]">
            {reportError}
          </div>
        )}

        <div className="regal-card rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-[#1a1a1a] tracking-wider">
                Report Date Range
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
                {rangeBadgeLabel}
              </span>
              {filtersLoading && (
                <span className="text-xs text-[#1a1a1a]/40">Loading filter data...</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-[#1a1a1a]/40 tracking-wider">
                Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setReportError(null)
                }}
                className="regal-input px-3 py-2 rounded-xl text-sm"
              />
              <label className="text-xs font-semibold text-[#1a1a1a]/40 tracking-wider">
                End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setReportError(null)
                }}
                className="regal-input px-3 py-2 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        <div className="regal-card rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Student Report
              </h3>
              <p className="text-xs text-[#1a1a1a]/50 mt-1">
                Generate a detailed report for a single student.
              </p>
            </div>
            <div className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
              PDF / CSV
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">
                Student
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(event) => {
                    setStudentSearch(event.target.value)
                    setSelectedStudent(null)
                    setReportError(null)
                  }}
                  placeholder="Search by student name..."
                  className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
                />
                {showStudentResults && (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-[#B8860B]/20 bg-white shadow-lg overflow-hidden">
                    {studentSearchLoading ? (
                      <div className="px-4 py-3 text-xs text-[#1a1a1a]/40">Searching...</div>
                    ) : studentMatches.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-[#1a1a1a]/40">No matches found</div>
                    ) : (
                      studentMatches.map((student) => (
                        <button
                          key={`${student.id || student.name}-${student.grade}-${student.section}`}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-[#f5f3ef] text-sm"
                          onClick={() => {
                            setSelectedStudent(student)
                            setStudentSearch(formatStudentLabel(student))
                            setStudentMatches([])
                            setReportError(null)
                          }}
                        >
                          <span className="font-semibold text-[#1a1a1a]">{student.name}</span>
                          <span className="text-xs text-[#1a1a1a]/40"> • Grade {student.grade}{student.section} • {student.house}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedStudent && !selectedStudentHasId && (
                <p className="mt-2 text-xs text-[#910000]">
                  Reselect this student from the lookup list before generating a report.
                </p>
              )}
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => generateStudentReport('PDF')}
                disabled={!selectedStudentHasId || isGenerating === 'student-PDF'}
                className="btn-gold px-4 py-2 text-sm rounded-xl disabled:opacity-60"
              >
                {isGenerating === 'student-PDF' ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={() => generateStudentReport('CSV')}
                disabled={!selectedStudentHasId || isGenerating === 'student-CSV'}
                className="px-4 py-2 text-sm rounded-xl border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition disabled:opacity-60"
              >
                {isGenerating === 'student-CSV' ? 'Generating...' : 'CSV'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  House Report
                </h3>
                <p className="text-xs text-[#1a1a1a]/50 mt-1">Totals and entries for a single house.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
                PDF / CSV
              </span>
            </div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">
              House
            </label>
            <select
              value={selectedHouse}
              onChange={(event) => {
                setSelectedHouse(event.target.value)
                setReportError(null)
              }}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm mb-4"
            >
              <option value="">Select house</option>
              {HOUSE_OPTIONS.map((house) => (
                <option key={house} value={house}>{house}</option>
              ))}
            </select>
            {selectedHouse && HOUSE_LOGOS[selectedHouse] && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#B8860B]/15 bg-[#fbf8f1] px-3 py-2">
                <img
                  src={HOUSE_LOGOS[selectedHouse]}
                  alt={`${selectedHouse} logo`}
                  className="h-10 w-10 object-contain"
                />
                <span className="text-sm font-medium text-[#1a1a1a]">{selectedHouse}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => generateHouseReport('PDF')}
                disabled={!selectedHouse || isGenerating === 'house-PDF'}
                className="btn-gold px-4 py-2 text-sm rounded-xl disabled:opacity-60"
              >
                {isGenerating === 'house-PDF' ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={() => generateHouseReport('CSV')}
                disabled={!selectedHouse || isGenerating === 'house-CSV'}
                className="px-4 py-2 text-sm rounded-xl border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition disabled:opacity-60"
              >
                {isGenerating === 'house-CSV' ? 'Generating...' : 'CSV'}
              </button>
            </div>
          </div>

          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Grade Report
                </h3>
                <p className="text-xs text-[#1a1a1a]/50 mt-1">Totals and entries for a grade.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
                PDF / CSV
              </span>
            </div>
            <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">
              Grade
            </label>
            <select
              value={selectedGrade}
              onChange={(event) => {
                setSelectedGrade(event.target.value)
                setSelectedSection('')
                setReportError(null)
              }}
              className="regal-input w-full px-3 py-2.5 rounded-xl text-sm mb-4"
            >
              <option value="">Select grade</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => generateGradeReport('PDF')}
                disabled={!selectedGrade || isGenerating === 'grade-PDF'}
                className="btn-gold px-4 py-2 text-sm rounded-xl disabled:opacity-60"
              >
                {isGenerating === 'grade-PDF' ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={() => generateGradeReport('CSV')}
                disabled={!selectedGrade || isGenerating === 'grade-CSV'}
                className="px-4 py-2 text-sm rounded-xl border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition disabled:opacity-60"
              >
                {isGenerating === 'grade-CSV' ? 'Generating...' : 'CSV'}
              </button>
            </div>
          </div>

          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Grade/Section Report
                </h3>
                <p className="text-xs text-[#1a1a1a]/50 mt-1">Totals and entries for one section.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
                PDF / CSV
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">
                  Grade
                </label>
                <select
                  value={selectedGrade}
                  onChange={(event) => {
                    setSelectedGrade(event.target.value)
                    setSelectedSection('')
                    setReportError(null)
                  }}
                  className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Grade</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a]/40 mb-1.5 tracking-wider">
                  Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(event) => {
                    setSelectedSection(event.target.value)
                    setReportError(null)
                  }}
                  className="regal-input w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Section</option>
                  {sectionOptions.map((section) => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => generateSectionReport('PDF')}
                disabled={!selectedGrade || !selectedSection || isGenerating === 'section-PDF'}
                className="btn-gold px-4 py-2 text-sm rounded-xl disabled:opacity-60"
              >
                {isGenerating === 'section-PDF' ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={() => generateSectionReport('CSV')}
                disabled={!selectedGrade || !selectedSection || isGenerating === 'section-CSV'}
                className="px-4 py-2 text-sm rounded-xl border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition disabled:opacity-60"
              >
                {isGenerating === 'section-CSV' ? 'Generating...' : 'CSV'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {templates.map((template) => (
            <div key={template.id} className="regal-card rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                    {template.title}
                  </h3>
                  <p className="text-xs text-[#1a1a1a]/50 mt-1">{template.description}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f3ef] text-[#1a1a1a]/60 border border-[#B8860B]/20">
                  {template.scope}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-[#1a1a1a]/40">{template.format}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => generateTemplateReport(template.id, 'PDF')}
                    disabled={isGenerating === `${template.id}-PDF`}
                    className="btn-gold px-4 py-2 text-sm rounded-xl disabled:opacity-60"
                  >
                    {isGenerating === `${template.id}-PDF` ? 'Generating...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => generateTemplateReport(template.id, 'CSV')}
                    disabled={isGenerating === `${template.id}-CSV`}
                    className="px-4 py-2 text-sm rounded-xl border border-[#B8860B]/30 text-[#1a1a1a] bg-white hover:border-[#B8860B]/60 transition disabled:opacity-60"
                  >
                    {isGenerating === `${template.id}-CSV` ? 'Generating...' : 'CSV'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="regal-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Saved Report Templates
          </h3>
          <p className="text-xs text-[#1a1a1a]/50 mt-1">
            Coming next: save custom filters, schedule exports, and track history.
          </p>
        </div>
      </div>
    </RequireRole>
  )
}
