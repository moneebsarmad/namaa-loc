'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Tables } from '@/lib/supabase/tables'
import CrestLoader from '@/components/CrestLoader'
import { useAuth } from '@/hooks/usePermissions'
import { canonicalHouseName, getHouseColors, getHouseNames } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface Student {
  id: string
  name: string
  grade: number
  section: string
  house: string
}

interface MeritCategory {
  id: string
  name: string
  description: string
  icon: string
  subcategories: MeritSubcategory[]
}

interface MeritSubcategory {
  id: string
  name: string
  description: string
  points: number
}

const DRAFT_STORAGE_KEY = 'admin:add-points:draft'

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

const meritCategories: MeritCategory[] = [
  {
    id: 'respect',
    name: 'Respect',
    description: 'Honoring Others and Community',
    icon: '🤝',
    subcategories: [
      { id: 'r1', name: 'Polite Language & Manners', description: 'Using kind words, greetings, waiting your turn', points: 5 },
      { id: 'r2', name: 'Helping Others', description: 'Assisting peers, showing sportsmanship', points: 10 },
      { id: 'r3', name: 'Inclusion', description: 'Inviting others to sit, play, or join activities', points: 10 },
      { id: 'r4', name: 'Conflict Resolution', description: 'Walking away from fights, making peace', points: 20 },
      { id: 'r5', name: 'Standing Up for Others', description: 'Defending against bullying, encouraging kindness', points: 50 },
      { id: 'r6', name: 'Other (please specify)', description: 'Add the details in the notes field', points: 10 },
    ],
  },
  {
    id: 'responsibility',
    name: 'Responsibility',
    description: 'Taking Ownership and Initiative',
    icon: '✅',
    subcategories: [
      { id: 's1', name: 'Personal Accountability', description: 'Owning mistakes, following through with commitments', points: 5 },
      { id: 's2', name: 'Cleanliness & Care', description: 'Keeping class, performing wuḍūʾ correctly, lockers, and campus clean', points: 10 },
      { id: 's3', name: 'Proactive Help', description: 'Helping teachers, assisting with school tasks without prompting', points: 10 },
      { id: 's4', name: 'Self-Discipline', description: 'Following instructions the first time, staying calm under pressure', points: 20 },
      { id: 's5', name: 'Other (please specify)', description: 'Add the details in the notes field', points: 10 },
    ],
  },
  {
    id: 'righteousness',
    name: 'Righteousness',
    description: 'Living Islamic Values',
    icon: '⭐',
    subcategories: [
      { id: 'g1', name: 'Prayer Etiquette', description: 'Proper ṣalāh behavior, lining up properly, respecting the musallā', points: 10 },
      { id: 'g2', name: 'Avoiding Harm', description: 'Not mocking, gossiping, or backbiting', points: 20 },
      { id: 'g3', name: 'Generosity of Spirit', description: 'Sharing, giving freely, thinking of others first', points: 20 },
      { id: 'g4', name: 'Controlling the Nafs', description: 'Resisting temptation, managing anger, overcoming selfishness', points: 20 },
      { id: 'g5', name: 'Other (please specify)', description: 'Add the details in the notes field', points: 10 },
    ],
  },
]

export default function AddPointsClient() {
  const { profile } = useAuth()
  const currentSchoolId = profile?.school_id ?? null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const [students, setStudents] = useState<Student[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([])
  const [selectedCategory, setSelectedCategory] = useState<MeritCategory | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<MeritSubcategory | null>(null)
  const [notes, setNotes] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminStaffId, setAdminStaffId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftCategoryIdRef = useRef<string | null>(null)
  const draftSubcategoryIdRef = useRef<string | null>(null)
  const houseColors = useMemo(() => getHouseColors(schoolHouses), [schoolHouses])
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])

  // Bulk selection filters
  const [filterGrade, setFilterGrade] = useState<string>('')
  const [filterSection, setFilterSection] = useState<string>('')
  const [filterHouse, setFilterHouse] = useState<string>('')

  useEffect(() => {
    if (!currentSchoolId) return
    fetchStudents()
    fetchAdminName()
  }, [currentSchoolId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = readDraft()
    if (!saved) return
    try {
      const draft = JSON.parse(saved) as {
        selectedStudents?: Student[]
        selectedCategoryId?: string | null
        selectedSubcategoryId?: string | null
        notes?: string
        eventDate?: string
        searchText?: string
        filterGrade?: string
        filterSection?: string
        filterHouse?: string
      }

      if (Array.isArray(draft.selectedStudents)) {
        setSelectedStudents(draft.selectedStudents)
      }
      setNotes(draft.notes ?? '')
      setEventDate(draft.eventDate ?? new Date().toISOString().split('T')[0])
      setSearchText(draft.searchText ?? '')
      setFilterGrade(draft.filterGrade ?? '')
      setFilterSection(draft.filterSection ?? '')
      setFilterHouse(draft.filterHouse ?? '')
      if (draft.selectedCategoryId) {
        draftCategoryIdRef.current = draft.selectedCategoryId
      }
      if (draft.selectedSubcategoryId) {
        draftSubcategoryIdRef.current = draft.selectedSubcategoryId
      }
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!draftCategoryIdRef.current) return
    const category = meritCategories.find((entry) => entry.id === draftCategoryIdRef.current)
    if (!category) return
    setSelectedCategory(category)
    if (draftSubcategoryIdRef.current) {
      const subcategory = category.subcategories.find((entry) => entry.id === draftSubcategoryIdRef.current)
      if (subcategory) {
        setSelectedSubcategory(subcategory)
      }
    }
    draftCategoryIdRef.current = null
    draftSubcategoryIdRef.current = null
  }, [selectedCategory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const draft = {
      selectedStudents,
      selectedCategoryId: selectedCategory?.id ?? null,
      selectedSubcategoryId: selectedSubcategory?.id ?? null,
      notes,
      eventDate,
      searchText,
      filterGrade,
      filterSection,
      filterHouse,
    }
    writeDraft(JSON.stringify(draft))
  }, [
    selectedStudents,
    selectedCategory,
    selectedSubcategory,
    notes,
    eventDate,
    searchText,
    filterGrade,
    filterSection,
    filterHouse,
  ])

  useEffect(() => {
    if (!currentSchoolId) return
    const channel = supabase
      .channel('add-points-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: Tables.students, filter: `school_id=eq.${currentSchoolId}` },
        () => {
          fetchStudents()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: Tables.staff, filter: `school_id=eq.${currentSchoolId}` },
        () => {
          fetchAdminName()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchoolId])

  const fetchAdminName = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('linked_staff_id')
        .eq('id', authData.user.id)
        .eq('school_id', currentSchoolId)
        .maybeSingle()

      const linkedStaffId = profile?.linked_staff_id ?? null
      setAdminStaffId(linkedStaffId)
      if (linkedStaffId) {
        const { data: staff } = await supabase
          .from('staff')
          .select('staff_name')
          .eq('id', linkedStaffId)
          .eq('school_id', currentSchoolId)
          .maybeSingle()

        if (staff?.staff_name) {
          setAdminName(staff.staff_name)
          return
        }
      }

      setAdminName(authData.user.email || 'Staff')
    } catch (error) {
      console.error('Error fetching admin name:', error)
    }
  }

  const fetchStudents = async () => {
    setIsLoading(true)
    try {
      const { data } = await supabase.from(Tables.students).select('*').eq('school_id', currentSchoolId)
      const allStudents: Student[] = (data || []).map((s, index) => ({
        id: s.student_id || s.id || `${index}`,
        name: s.student_name || '',
        grade: s.grade || 0,
        section: s.section || '',
        house: s.house || '',
      }))
      setStudents(allStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setIsLoading(false)
    }
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

  const selectedStudentIds = new Set(selectedStudents.map((student) => student.id))

  const filteredStudents = students
    .filter((s) => searchText && s.name.toLowerCase().includes(searchText.toLowerCase()) && !selectedStudentIds.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10)

  // Get unique values for filters
  const availableGrades = [...new Set(students.map((s) => s.grade))].sort((a, b) => a - b)
  const availableSections = [...new Set(
    students
      .filter((s) => !filterGrade || s.grade === Number(filterGrade))
      .map((s) => s.section)
  )].filter(Boolean).sort()
  const availableHouses = houseNames.length ? houseNames : [...new Set(students.map((s) => canonicalHouseName(s.house, schoolHouses)))]
    .filter(Boolean)
    .sort()

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

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const handleSubmit = async () => {
    if (selectedStudents.length === 0 || !selectedCategory || !selectedSubcategory) return
    if (!adminName || adminName.includes('@')) {
      showToast('Your staff name is not set. Please contact an admin.', 'error', 5000)
      return
    }
    if (!adminStaffId) {
      showToast('Your staff account is not linked. Please contact an admin.', 'error', 5000)
      return
    }

    setIsSubmitting(true)
    showToast('Submitting points...', 'info', 4000)
    try {
      const now = new Date().toISOString()
      const errors: { student: Student; message: string }[] = []

      for (const student of selectedStudents) {
        const meritEntry = {
          student_id: student.id,
          staff_id: adminStaffId,
          timestamp: now,
          date_of_event: eventDate || new Date().toISOString().split('T')[0],
          student_name: student.name,
          grade: student.grade,
          section: student.section,
          house: canonicalHouseName(student.house, schoolHouses)?.trim() || student.house?.trim(),
          r: `${selectedCategory.name} – ${selectedCategory.description}`,
          subcategory: selectedSubcategory.name,
          points: selectedSubcategory.points,
          notes: notes,
          staff_name: adminName,
        }

        const { error } = await supabase.from(Tables.meritLog).insert([meritEntry])
        if (error) {
          const detail = error.details ? ` (${error.details})` : ''
          errors.push({ student, message: `${error.message}${detail}` })
        }
      }

      if (errors.length > 0) {
        console.error('Error adding merit:', errors)
        showToast(
          `Failed for ${errors.length} student${errors.length === 1 ? '' : 's'} — ${errors[0].student.name}: ${errors[0].message}`,
          'error',
          5000
        )
        return
      }

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
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedStudents([])
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setNotes('')
    setEventDate(new Date().toISOString().split('T')[0])
    setSearchText('')
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

  if (isLoading) {
    return <CrestLoader label="Loading..." />
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Add Points
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
          <p className="text-[#1a1a1a]/50 text-sm font-medium">Award merit points to students</p>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-[#055437]/10 border border-[#055437]/20 text-[#055437] px-5 py-4 rounded-xl mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#055437] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-medium">
            Points awarded to {selectedStudents.length || 'selected'} student{selectedStudents.length === 1 ? '' : 's'}!
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
                        backgroundColor: `${houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a'}20`,
                        color: houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a',
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

          {/* Bulk Selection Filters */}
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
                  <option key={house} value={house}>{house?.replace('House of ', '')}</option>
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

          {/* Or search individually */}
          <div className="relative mb-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1a1a1a]/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-[#1a1a1a]/40">or search individually</span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search for a student..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full px-4 py-3 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none mb-3 transition-all"
          />
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
                      backgroundColor: `${houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a'}20`,
                      color: houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a',
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
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Select Category</h2>
        </div>

        <div className="space-y-3">
          {meritCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategory(category)
                setSelectedSubcategory(null)
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                selectedCategory?.id === category.id
                  ? 'border-[#B8860B] bg-[#B8860B]/5'
                  : 'border-[#1a1a1a]/10 hover:border-[#B8860B]/30'
              }`}
            >
              <span className="text-2xl">{category.icon}</span>
              <div className="text-left flex-1">
                <p className="font-medium text-[#1a1a1a]">{category.name}</p>
                <p className="text-sm text-[#1a1a1a]/50">{category.description}</p>
              </div>
              {selectedCategory?.id === category.id && (
                <div className="w-6 h-6 rounded-full bg-[#B8860B] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedCategory && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Select Reason</h2>
          </div>

          <div className="space-y-2">
            {selectedCategory.subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubcategory(sub)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  selectedSubcategory?.id === sub.id
                    ? 'border-[#B8860B] bg-[#B8860B]/5'
                    : 'border-[#1a1a1a]/10 hover:border-[#B8860B]/30'
                }`}
              >
                <div className="text-left flex-1">
                  <p className="font-medium text-[#1a1a1a]">{sub.name}</p>
                  <p className="text-sm text-[#1a1a1a]/50">{sub.description}</p>
                </div>
                <span className="font-bold text-[#055437]">+{sub.points}</span>
                {selectedSubcategory?.id === sub.id && (
                  <div className="w-6 h-6 rounded-full bg-[#B8860B] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSubcategory && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
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

      {selectedSubcategory && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-gradient-to-br from-[#B8860B] to-[#8b6508] text-white rounded-full flex items-center justify-center font-bold text-sm">5</span>
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

      {selectedStudents.length > 0 && selectedCategory && selectedSubcategory && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
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
                Award {selectedSubcategory.points} points to {selectedStudents.length} student{selectedStudents.length === 1 ? '' : 's'}
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
// Force rebuild 1767720451
