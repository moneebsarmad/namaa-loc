'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../providers'
import CrestLoader from '../../../components/CrestLoader'
import { useUserProfile } from '../../../hooks/usePermissions'
import { AccessDenied } from '@/components/PermissionGate'
import { canBrowseStudentDirectory, canUseStudentLookup } from '@/lib/portalRoles'
import { canonicalHouseName, getHouseColors, getHouseNames, type SchoolHouseRecord } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface Student {
  id: string
  name: string
  grade: number
  section: string
  house: string
}

interface Category {
  id: string
  r: string
  subcategory: string
  points: number
}

interface Domain {
  id: number
  domain_key: string
  display_name: string
  color: string
}

const DRAFT_STORAGE_KEY = 'portal:add-points:draft'
const HOUSE_COMPETITION_R = 'House Competition'

function readDraft(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (stored) return stored
    const legacy = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (legacy) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, legacy)
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    }
    return legacy
  } catch {
    return null
  }
}

function writeDraft(value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, value)
  } catch {
    // Ignore storage errors (quota, private mode)
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Ignore storage errors (quota, private mode)
  }
}

function getHouseColor(house: string, houseColors: Record<string, string>, schoolHouses: SchoolHouseRecord[] = []): string {
  const canonical = canonicalHouseName(house, schoolHouses)
  return houseColors[canonical] || '#1a1a1a'
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function AddPointsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { profile, loading: profileLoading } = useUserProfile()
  const currentSchoolId = profile?.school_id ?? (user?.app_metadata?.school_id ? String(user.app_metadata.school_id) : null)
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const dbRole = profile?.role ?? null
  const canBrowseDirectory = canBrowseStudentDirectory(dbRole)
  const canLookupStudents = canUseStudentLookup(dbRole)
  const isSuperAdmin = dbRole === 'super_admin'
  const [students, setStudents] = useState<Student[]>([])
  const [lookupResults, setLookupResults] = useState<Student[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([])
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [selectedR, setSelectedR] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [notes, setNotes] = useState('')
  const [houseCompetitionPoints, setHouseCompetitionPoints] = useState('')
  const [houseCompetitionHouse, setHouseCompetitionHouse] = useState('')
  const [houseCompetitionNotes, setHouseCompetitionNotes] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isLoading, setIsLoading] = useState(true)
  const [isLookupLoading, setIsLookupLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitInFlightRef = useRef(false)
  const draftCategoryIdRef = useRef<string | null>(null)
  const draftDomainIdRef = useRef<number | null>(null)
  const houseColors = useMemo(() => getHouseColors(schoolHouses), [schoolHouses])

  // Bulk selection filters
  const [filterGrade, setFilterGrade] = useState<string>('')
  const [filterSection, setFilterSection] = useState<string>('')
  const [filterHouse, setFilterHouse] = useState<string>('')
  const houseOptions = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])
  const houseCompetitionEnabled = false
  const isHouseCompetition = houseCompetitionEnabled && selectedR === HOUSE_COMPETITION_R
  const canSubmitHouseCompetition =
    isHouseCompetition &&
    isSuperAdmin &&
    Boolean(houseCompetitionHouse) &&
    Number(houseCompetitionPoints) > 0

  useEffect(() => {
    if (!userId || profileLoading) return
    if (!currentSchoolId) {
      setStudents([])
      setLookupResults([])
      setCategories([])
      setDomains([])
      setIsLoading(false)
      return
    }

    if (!canLookupStudents) {
      setStudents([])
      setLookupResults([])
      setCategories([])
      setDomains([])
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        if (canBrowseDirectory) {
          const [studentsRes, categoriesRes, domainsRes] = await Promise.all([
            supabase.from('students').select('*').eq('school_id', currentSchoolId),
            supabase.from('3r_categories').select('*'),
            supabase.from('merit_domains').select('*').eq('is_active', true).order('display_order'),
          ])
          const allStudents: Student[] = (studentsRes.data || []).map((s, index) => ({
            id: s.student_id || s.id || `${index}`,
            name: s.student_name || '',
            grade: s.grade || 0,
            section: s.section || '',
            house: s.house || '',
          }))
          setStudents(allStudents)

          const allCategories: Category[] = (categoriesRes.data || []).map((c) => ({
            id: c.id,
            r: c.r || '',
            subcategory: c.subcategory || '',
            points: c.points || 0,
          }))
          setCategories(allCategories)

          const allDomains: Domain[] = (domainsRes.data || []).map((d) => ({
            id: d.id,
            domain_key: d.domain_key || '',
            display_name: d.display_name || '',
            color: d.color || '#2D5016',
          }))
          setDomains(allDomains)
        } else {
          const [categoriesRes, domainsRes] = await Promise.all([
            supabase.from('3r_categories').select('*'),
            supabase.from('merit_domains').select('*').eq('is_active', true).order('display_order'),
          ])
          setStudents([])
          const allCategories: Category[] = (categoriesRes.data || []).map((c) => ({
            id: c.id,
            r: c.r || '',
            subcategory: c.subcategory || '',
            points: c.points || 0,
          }))
          setCategories(allCategories)

          const allDomains: Domain[] = (domainsRes.data || []).map((d) => ({
            id: d.id,
            domain_key: d.domain_key || '',
            display_name: d.display_name || '',
            color: d.color || '#2D5016',
          }))
          setDomains(allDomains)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [canBrowseDirectory, canLookupStudents, currentSchoolId, profileLoading, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = readDraft()
    if (!saved) return
    try {
      const draft = JSON.parse(saved) as {
        selectedStudents?: Student[]
        selectedDomainId?: number | null
        selectedR?: string | null
        selectedCategoryId?: string | null
        notes?: string
        houseCompetitionPoints?: string
        houseCompetitionHouse?: string
        houseCompetitionNotes?: string
        eventDate?: string
        searchText?: string
        filterGrade?: string
        filterSection?: string
        filterHouse?: string
      }

      if (Array.isArray(draft.selectedStudents)) {
        setSelectedStudents(draft.selectedStudents)
      }
      const nextSelectedR = draft.selectedR === HOUSE_COMPETITION_R ? null : draft.selectedR ?? null
      setSelectedR(nextSelectedR)
      setNotes(draft.notes ?? '')
      setHouseCompetitionPoints(draft.houseCompetitionPoints ?? '')
      setHouseCompetitionHouse(draft.houseCompetitionHouse ?? '')
      setHouseCompetitionNotes(draft.houseCompetitionNotes ?? '')
      setEventDate(draft.eventDate ?? new Date().toISOString().split('T')[0])
      setSearchText(draft.searchText ?? '')
      setFilterGrade(draft.filterGrade ?? '')
      setFilterSection(draft.filterSection ?? '')
      setFilterHouse(draft.filterHouse ?? '')
      if (draft.selectedCategoryId) {
        draftCategoryIdRef.current = draft.selectedCategoryId
      }
      if (draft.selectedDomainId) {
        draftDomainIdRef.current = draft.selectedDomainId
      }
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!draftCategoryIdRef.current) return
    const match = categories.find((category) => category.id === draftCategoryIdRef.current)
    if (!match) return
    setSelectedCategory(match)
    if (!selectedR && match.r) {
      setSelectedR(match.r)
    }
    draftCategoryIdRef.current = null
  }, [categories, selectedR])

  useEffect(() => {
    if (!draftDomainIdRef.current) return
    const match = domains.find((domain) => domain.id === draftDomainIdRef.current)
    if (!match) return
    setSelectedDomain(match)
    draftDomainIdRef.current = null
  }, [domains])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const draft = {
      selectedStudents,
      selectedDomainId: selectedDomain?.id ?? null,
      selectedR,
      selectedCategoryId: selectedCategory?.id ?? null,
      notes,
      houseCompetitionPoints,
      houseCompetitionHouse,
      houseCompetitionNotes,
      eventDate,
      searchText,
      filterGrade,
      filterSection,
      filterHouse,
    }
    writeDraft(JSON.stringify(draft))
  }, [
    selectedStudents,
    selectedDomain,
    selectedR,
    selectedCategory,
    notes,
    houseCompetitionPoints,
    houseCompetitionHouse,
    houseCompetitionNotes,
    eventDate,
    searchText,
    filterGrade,
    filterSection,
    filterHouse,
  ])

  const selectedStudentIds = new Set(selectedStudents.map((student) => student.id))

  useEffect(() => {
    if (profileLoading || !canLookupStudents || canBrowseDirectory) {
      if (canBrowseDirectory) {
        setLookupResults([])
      }
      return
    }

    const search = searchText.trim()
    if (search.length < 2) {
      setLookupResults([])
      setIsLookupLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchLookupResults = async () => {
      setIsLookupLoading(true)
      try {
        const response = await fetch(`/api/students/lookup?search=${encodeURIComponent(search)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          setLookupResults([])
          return
        }

        const payload = await response.json() as {
          success?: boolean
          data?: Array<{
            id: string
            student_name: string
            grade: number
            section: string
            house: string
          }>
        }

        const results = (payload.data || []).map((student) => ({
          id: String(student.id ?? ''),
          name: String(student.student_name ?? ''),
          grade: Number(student.grade ?? 0),
          section: String(student.section ?? ''),
          house: String(student.house ?? ''),
        }))

        setLookupResults(results)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error searching students:', error)
          setLookupResults([])
        }
      } finally {
        setIsLookupLoading(false)
      }
    }

    fetchLookupResults()

    return () => {
      controller.abort()
    }
  }, [canBrowseDirectory, canLookupStudents, profileLoading, searchText])

  const filteredStudents = (canBrowseDirectory ? students : lookupResults)
    .filter((s) => {
      if (selectedStudentIds.has(s.id)) return false
      if (!canBrowseDirectory) return true
      return searchText ? s.name.toLowerCase().includes(searchText.toLowerCase()) : false
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10)

  const rOptions = [...new Set(categories.map((c) => c.r))].filter(Boolean)
  const subcategories = selectedR ? categories.filter((c) => c.r === selectedR) : []

  // Get unique values for filters
  const availableGrades = [...new Set(students.map((s) => s.grade))].sort((a, b) => a - b)
  const availableSections = [...new Set(
    students
      .filter((s) => !filterGrade || s.grade === Number(filterGrade))
      .map((s) => s.section)
  )].filter(Boolean).sort()
  const availableHouses = [...new Set(students.map((s) => canonicalHouseName(s.house, schoolHouses)))].filter(Boolean).sort()

  // Get students matching bulk filters
  const bulkFilteredStudents = students.filter((s) => {
    if (selectedStudentIds.has(s.id)) return false
    if (filterGrade && s.grade !== Number(filterGrade)) return false
    if (filterSection && s.section !== filterSection) return false
    if (filterHouse && canonicalHouseName(s.house, schoolHouses) !== filterHouse) return false
    return true
  })

  const hasActiveFilters = filterGrade || filterSection || filterHouse

  const handleAddAllFiltered = () => {
    setSelectedStudents((prev) => [...prev, ...bulkFilteredStudents])
    setFilterGrade('')
    setFilterSection('')
    setFilterHouse('')
  }

  const clearFilters = () => {
    setFilterGrade('')
    setFilterSection('')
    setFilterHouse('')
  }

  const showToast = (message: string, type: 'info' | 'success' | 'error', duration = 2500) => {
    setToast({ message, type })
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, duration)
  }

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return
    if (!isHouseCompetition && (selectedStudents.length === 0 || !selectedCategory)) return
    submitInFlightRef.current = true
    setIsSubmitting(true)
    showToast('Submitting points...', 'info', 4000)
    try {
      if (isHouseCompetition) {
        if (!isSuperAdmin) {
          showToast('Only super admins can award house competition points.', 'error', 5000)
          return
        }

        const parsedPoints = Number(houseCompetitionPoints)
        if (!houseCompetitionHouse || !Number.isFinite(parsedPoints) || parsedPoints <= 0) {
          showToast('Enter points and select a house.', 'error', 5000)
          return
        }

        const response = await fetch('/api/points/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'house_competition',
            house: canonicalHouseName(houseCompetitionHouse, schoolHouses)?.trim() || houseCompetitionHouse?.trim(),
            points: parsedPoints,
            notes: houseCompetitionNotes,
            eventDate,
          }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          showToast(payload.error || 'Failed to add house points.', 'error', 5000)
          return
        }

        setSuccessMessage(`Points awarded to ${canonicalHouseName(houseCompetitionHouse, schoolHouses) || 'selected house'}!`)
        setShowSuccess(true)
        showToast('Points submitted!', 'success')
        setTimeout(() => {
          setShowSuccess(false)
          resetForm()
        }, 2000)
        return
      }

      const response = await fetch('/api/points/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'students',
            categoryId: selectedCategory?.id,
            domainId: selectedDomain?.id,
            students: selectedStudents.map((student) => ({
              id: student.id,
              name: student.name,
              grade: student.grade,
              section: student.section,
              house: canonicalHouseName(student.house, schoolHouses)?.trim() || student.house?.trim(),
            })),
          notes,
          eventDate,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        showToast(payload.error || 'Failed to add points.', 'error', 5000)
        return
      }

      setSuccessMessage(
        `Points awarded to ${selectedStudents.length || 'selected'} student${selectedStudents.length === 1 ? '' : 's'}!`
      )
      setShowSuccess(true)
      showToast('Points submitted!', 'success')
      setTimeout(() => {
        setShowSuccess(false)
        resetForm()
      }, 2000)
    } catch (error) {
      console.error('Error:', error)
      showToast('Failed to add points. Please try again.', 'error', 5000)
    } finally {
      submitInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedStudents([])
    setSelectedDomain(null)
    setSelectedR(null)
    setSelectedCategory(null)
    setNotes('')
    setHouseCompetitionPoints('')
    setHouseCompetitionHouse('')
    setHouseCompetitionNotes('')
    setEventDate(new Date().toISOString().split('T')[0])
    setSearchText('')
    setLookupResults([])
    clearDraft()
  }

  const handleAddStudent = (student: Student) => {
    if (selectedStudentIds.has(student.id)) return
    setSelectedStudents((prev) => [...prev, student])
    setSearchText('')
  }

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((student) => student.id !== studentId))
  }

  if (isLoading || profileLoading || housesLoading) {
    return (
      <CrestLoader label="Loading..." />
    )
  }

  if (!canLookupStudents) {
    return <AccessDenied message="Staff access is required to award points." />
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Add Points
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Award merit points to students</p>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-[#055437]/10 border border-[#055437]/20 text-[#055437] px-5 py-4 rounded-xl mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#055437] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-medium">
            {successMessage || 'Points submitted!'}
          </span>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border ${
            toast.type === 'success'
              ? 'bg-[#055437] text-white border-[#055437]/80'
              : toast.type === 'error'
              ? 'bg-[#910000] text-white border-[#910000]/80'
              : 'bg-[#1a1a1a] text-white border-[#1a1a1a]/80'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Step 1: Select Student */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Select Students</h2>
        </div>

        <div>
          {selectedStudents.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-[#1a1a1a]/70">
                  Selected ({selectedStudents.length})
                </p>
                <button
                  onClick={() => setSelectedStudents([])}
                  className="text-[#B8860B] hover:text-[#8b6508] font-medium text-sm transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleRemoveStudent(student.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#faf9f7] border border-[#B8860B]/20 text-sm text-[#1a1a1a] hover:border-[#B8860B]/50 transition-colors"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: `${getHouseColor(student.house, houseColors, schoolHouses)}15`,
                        color: getHouseColor(student.house, houseColors, schoolHouses),
                      }}
                    >
                      {getInitials(student.name)}
                    </span>
                    <span>{student.name}</span>
                    <span className="text-[#1a1a1a]/30">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {canBrowseDirectory ? (
            <>
              <div className="mb-4 p-4 bg-[#faf9f7] rounded-xl border border-[#1a1a1a]/5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[#1a1a1a]/70">Bulk Select</p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-[#B8860B] hover:text-[#8b6508] font-medium text-xs transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <select
                    value={filterGrade}
                    onChange={(e) => {
                      setFilterGrade(e.target.value)
                      setFilterSection('')
                    }}
                    className="px-3 py-2 border border-[#1a1a1a]/10 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
                  >
                    <option value="">All Grades</option>
                    {availableGrades.map((grade) => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="px-3 py-2 border border-[#1a1a1a]/10 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
                  >
                    <option value="">All Sections</option>
                    {availableSections.map((section) => (
                      <option key={section} value={section}>Section {section}</option>
                    ))}
                  </select>
                  <select
                    value={filterHouse}
                    onChange={(e) => setFilterHouse(e.target.value)}
                    className="px-3 py-2 border border-[#1a1a1a]/10 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
                  >
                    <option value="">All Houses</option>
                    {availableHouses.map((house) => (
                  <option key={house} value={canonicalHouseName(house, schoolHouses)}>{canonicalHouseName(house, schoolHouses)?.replace('House of ', '')}</option>
                    ))}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={handleAddAllFiltered}
                    disabled={bulkFilteredStudents.length === 0}
                    className="w-full py-2 px-4 bg-[#B8860B]/10 hover:bg-[#B8860B]/20 text-[#8b6508] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add {bulkFilteredStudents.length} student{bulkFilteredStudents.length === 1 ? '' : 's'}
                  </button>
                )}
              </div>

              <div className="relative mb-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1a1a1a]/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-[#1a1a1a]/40">or search individually</span>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-4 rounded-xl border border-[#B8860B]/15 bg-[#faf9f7] px-4 py-3 text-sm text-[#1a1a1a]/60">
              Search and select students individually. Full student directory browsing is restricted for your role.
            </div>
          )}

          <input
            type="text"
            placeholder="Search for a student..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none mb-3 transition-all"
          />
          {!canBrowseDirectory && searchText.trim().length < 2 && (
            <p className="mb-3 text-sm text-[#1a1a1a]/45">Enter at least 2 characters to search.</p>
          )}
          {isLookupLoading && !canBrowseDirectory && (
            <p className="mb-3 text-sm text-[#1a1a1a]/45">Searching students...</p>
          )}
          {filteredStudents.length > 0 && (
            <div className="border border-[#1a1a1a]/10 rounded-xl overflow-hidden">
              {filteredStudents.map((student, index) => (
                <button
                  key={student.id}
                  onClick={() => handleAddStudent(student)}
                  className={`w-full flex items-center gap-4 p-3.5 hover:bg-[#faf9f7] transition-colors ${
                    index !== filteredStudents.length - 1 ? 'border-b border-[#1a1a1a]/5' : ''
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: `${getHouseColor(student.house, houseColors, schoolHouses)}15`,
                      color: getHouseColor(student.house, houseColors, schoolHouses),
                    }}
                  >
                    {getInitials(student.name)}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-[#1a1a1a]">{student.name}</p>
                    <p className="text-sm text-[#1a1a1a]/50">
                      Grade {student.grade}{student.section} • {canonicalHouseName(student.house, schoolHouses)?.replace('House of ', '')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!canBrowseDirectory && !isLookupLoading && searchText.trim().length >= 2 && filteredStudents.length === 0 && (
            <p className="text-sm text-[#1a1a1a]/45">No students found for that search.</p>
          )}
        </div>
      </div>

      {/* Step 2: Select Domain */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            selectedStudents.length > 0
              ? 'bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white'
              : 'bg-[#1a1a1a]/10 text-[#1a1a1a]/40'
          }`}>2</span>
          <h2 className={`text-lg font-semibold ${selectedStudents.length > 0 ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]/40'}`}>
            Where did this happen?
          </h2>
        </div>

        <p className="text-sm text-[#1a1a1a]/50 mb-4">Select the domain where the behavior was observed</p>

        <div className="grid grid-cols-2 gap-3">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setSelectedDomain(domain)}
              disabled={selectedStudents.length === 0}
              className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                selectedDomain?.id === domain.id
                  ? 'bg-[#2D5016] text-white border-2 border-[#2D5016]'
                  : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a]/10 hover:border-[#2D5016]/30'
              } ${selectedStudents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {selectedDomain?.id === domain.id && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {domain.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Select Category */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            selectedDomain
              ? 'bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white'
              : 'bg-[#1a1a1a]/10 text-[#1a1a1a]/40'
          }`}>3</span>
          <h2 className={`text-lg font-semibold ${selectedDomain ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]/40'}`}>
            Select Category
          </h2>
        </div>

        <p className="text-sm text-[#1a1a1a]/50 mb-4">Choose the type of recognition</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rOptions.map((r) => (
            <button
              key={r}
              onClick={() => {
                setSelectedR(r)
                setSelectedCategory(null)
              }}
              disabled={!selectedDomain}
              className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                selectedR === r
                  ? 'bg-[#2D5016] text-white border-2 border-[#2D5016]'
                  : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a]/10 hover:border-[#2D5016]/30'
              } ${!selectedDomain ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {selectedR === r && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {r}
            </button>
          ))}
        </div>
        {isSuperAdmin && houseCompetitionEnabled && (
          <button
            onClick={() => {
              setSelectedR(HOUSE_COMPETITION_R)
              setSelectedCategory(null)
              setSelectedStudents([])
            }}
            className={`mt-3 w-full px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              selectedR === HOUSE_COMPETITION_R
                ? 'bg-[#2D5016] text-white border-2 border-[#2D5016]'
                : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a]/10 hover:border-[#2D5016]/30'
            }`}
          >
            {selectedR === HOUSE_COMPETITION_R && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            House Competition
          </button>
        )}
      </div>

      {/* Step 4: Select Reason */}
      {selectedR && !isHouseCompetition && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Select Reason</h2>
          </div>

          <p className="text-sm text-[#1a1a1a]/50 mb-4">What did the student do?</p>

          <div className="grid grid-cols-2 gap-3">
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedCategory(sub)}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-between gap-2 ${
                  selectedCategory?.id === sub.id
                    ? 'bg-[#2D5016] text-white border-2 border-[#2D5016]'
                    : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a]/10 hover:border-[#2D5016]/30'
                }`}
              >
                <span className="flex items-center gap-2">
                  {selectedCategory?.id === sub.id && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className="text-left">{sub.subcategory}</span>
                </span>
                <span className={`font-bold flex-shrink-0 ${selectedCategory?.id === sub.id ? 'text-white' : 'text-[#2D5016]'}`}>
                  +{sub.points}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isHouseCompetition && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">House Competition Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a]/70 mb-2">Points</label>
              <input
                type="number"
                min={1}
                step={1}
                value={houseCompetitionPoints}
                onChange={(e) => setHouseCompetitionPoints(e.target.value)}
                placeholder="Enter points"
                className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a]/70 mb-2">House</label>
              <select
                value={houseCompetitionHouse}
                onChange={(e) => setHouseCompetitionHouse(e.target.value)}
                className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none transition-all bg-white"
              >
                <option value="">Select house</option>
                {houseOptions.map((house) => (
                  <option key={house} value={house}>{house}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a]/70 mb-2">Competition Note</label>
            <textarea
              placeholder="Describe the competition..."
              value={houseCompetitionNotes}
              onChange={(e) => setHouseCompetitionNotes(e.target.value)}
              className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none resize-none transition-all"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Step 5: Date of Event */}
      {(selectedCategory || isHouseCompetition) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">5</span>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Date of Event</h2>
          </div>

          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none transition-all"
          />
        </div>
      )}

      {/* Step 6: Notes */}
      {selectedCategory && !isHouseCompetition && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">6</span>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Add Notes (Optional)</h2>
          </div>

          <textarea
            placeholder="Add any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none resize-none transition-all"
            rows={3}
          />
        </div>
      )}

      {/* Submit Button */}
      {((selectedStudents.length > 0 && selectedCategory) || canSubmitHouseCompetition) && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (isHouseCompetition && !canSubmitHouseCompetition)}
          className="w-full bg-gradient-to-r from-[#B8860B] to-[#8b6508] text-white py-4 px-6 rounded-xl font-medium hover:from-[#8b6508] hover:to-[#7a5f14] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>
                {isHouseCompetition
                  ? `Award ${houseCompetitionPoints || 0} points to ${canonicalHouseName(houseCompetitionHouse, schoolHouses) || 'house'}`
                  : `Award ${selectedCategory?.points} points to ${selectedStudents.length} student${selectedStudents.length === 1 ? '' : 's'}`
                }
              </span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  )
}
// Force rebuild 1767720489
