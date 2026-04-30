'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import CrestLoader from '../../../components/CrestLoader'
import { useSessionStorageState } from '../../../hooks/useSessionStorageState'
import { ROLES } from '../../../lib/permissions'
import { useUserProfile, useUserRole } from '../../../hooks/usePermissions'
import { AccessDenied } from '@/components/PermissionGate'
import { canBrowseStudentDirectory, hasAdminPortalAccess } from '@/lib/portalRoles'
import { canonicalHouseName, getHouseColors, getHouseNames } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface Student {
  id: string
  name: string
  grade: number
  section: string
  house: string
  points: number | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function StudentsPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { profile, loading: profileLoading } = useUserProfile()
  const currentSchoolId = profile?.school_id ?? null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const isParent = role === ROLES.PARENT
  const dbRole = profile?.role ?? null
  const canBrowseDirectory = canBrowseStudentDirectory(dbRole)
  const isAdmin = hasAdminPortalAccess(dbRole)
  const [students, setStudents] = useState<Student[]>([])
  const [searchText, setSearchText] = useSessionStorageState('portal:students:searchText', '')
  const [selectedGrade, setSelectedGrade] = useSessionStorageState<string | null>('portal:students:selectedGrade', null)
  const [selectedSection, setSelectedSection] = useSessionStorageState<string | null>('portal:students:selectedSection', null)
  const [selectedHouse, setSelectedHouse] = useSessionStorageState<string | null>('portal:students:selectedHouse', null)
  const [isLoading, setIsLoading] = useState(true)
  const houseColors = useMemo(() => getHouseColors(schoolHouses), [schoolHouses])
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses])

  useEffect(() => {
    if (roleLoading || profileLoading) {
      return
    }

    if (!currentSchoolId) {
      setIsLoading(false)
      return
    }

    if (isParent || canBrowseDirectory) {
      fetchData()
      return
    }

    setIsLoading(false)
  }, [canBrowseDirectory, currentSchoolId, isParent, profileLoading, roleLoading])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      let allStudents: Student[] = []

      if (isParent) {
        const { data: linkedStudents, error } = await supabase
          .from('parent_students')
          .select('student:students(student_id, student_name, grade, section, house)')
          .eq('school_id', currentSchoolId)

        if (error) {
          throw error
        }

        allStudents = (linkedStudents || [])
          .map((row, index) => {
            const s = (row as { student: any }).student
            if (!s) return null
            return {
              id: String(s.student_id ?? index),
              name: s.student_name || '',
              grade: s.grade || 0,
              section: s.section || '',
              house: s.house || '',
              points: null,
            } as Student
          })
          .filter(Boolean) as Student[]
      } else {
        const { data: studentData, error } = await supabase
          .from('students')
          .select('student_id, student_name, grade, section, house')
          .eq('school_id', currentSchoolId)
        if (error) {
          throw error
        }

        allStudents = (studentData || []).map((s, index) => ({
          id: String(s.student_id ?? index),
          name: s.student_name || '',
          grade: s.grade || 0,
          section: s.section || '',
          house: s.house || '',
          points: isAdmin ? 0 : null,
        }))
      }

      const studentIds = allStudents.map((s) => s.id).filter(Boolean)
      if (isAdmin && studentIds.length > 0) {
        const { data: pointsData, error: pointsError } = await supabase
          .from('student_points_view')
          .select('student_id, total_points')
          .eq('school_id', currentSchoolId)
          .in('student_id', studentIds)

        if (pointsError) {
          throw pointsError
        }

        const pointsMap = new Map<string, number>()
        ;(pointsData || []).forEach((row) => {
          const id = String(row.student_id ?? '')
          if (!id) return
          pointsMap.set(id, Number(row.total_points ?? 0))
        })

        allStudents = allStudents.map((s) => ({
          ...s,
          points: pointsMap.get(s.id) || 0,
        }))
      }

      setStudents(allStudents)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const grades = [...new Set(students.map((s) => s.grade))].sort((a, b) => a - b)
  const sections = [...new Set(students.map((s) => s.section).filter(Boolean))].sort()
  const houses = houseNames.length ? houseNames : [...new Set(students.map((s) => canonicalHouseName(s.house, schoolHouses)))].filter(Boolean)

  const filteredStudents = students
    .filter((s) => {
      if (searchText && !s.name.toLowerCase().includes(searchText.toLowerCase())) return false
      if (selectedGrade && s.grade !== parseInt(selectedGrade)) return false
      if (selectedSection && s.section !== selectedSection) return false
      if (selectedHouse && canonicalHouseName(s.house, schoolHouses) !== selectedHouse) return false
      return true
    })
    .sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade
      if (a.section !== b.section) return a.section.localeCompare(b.section)
      return a.name.localeCompare(b.name)
    })

  const groupedStudents: Record<string, Student[]> = {}
  filteredStudents.forEach((s) => {
    const key = `${s.grade}${s.section}`
    if (!groupedStudents[key]) groupedStudents[key] = []
    groupedStudents[key].push(s)
  })

  if (roleLoading || profileLoading || isLoading || housesLoading) {
    return (
      <CrestLoader label="Loading students..." />
    )
  }

  if (!isParent && !canBrowseDirectory) {
    return <AccessDenied message="Student directory access is limited to admins and house mentors." />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Student List */}
      <div className="w-full transition-all duration-300">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {isParent ? 'My Children' : 'Students'}
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-1 w-16 bg-gradient-to-r from-[#B8860B] to-[#d4a017] rounded-full"></div>
            <p className="text-[#1a1a1a]/50 text-sm font-medium">
              {isParent ? `${students.length} linked student${students.length === 1 ? '' : 's'}` : `${students.length} students enrolled`}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#B8860B]/10 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search students..."
                aria-label="Search students"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none transition-all"
              />
            </div>

            {/* Grade Filter */}
            <select
              aria-label="Filter by grade"
              value={selectedGrade || ''}
              onChange={(e) => setSelectedGrade(e.target.value || null)}
              className="px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
            >
              <option value="">All Grades</option>
              {grades.map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>

            {/* House Filter */}
            <select
              aria-label="Filter by house"
              value={selectedHouse || ''}
              onChange={(e) => setSelectedHouse(e.target.value || null)}
              className="px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
            >
              <option value="">All Houses</option>
              {houses.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Section Filter */}
            <select
              aria-label="Filter by section"
              value={selectedSection || ''}
              onChange={(e) => setSelectedSection(e.target.value || null)}
              className="px-4 py-2.5 border border-[#1a1a1a]/10 rounded-xl focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none bg-white"
            >
              <option value="">All Sections</option>
              {sections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-6">
          {Object.entries(groupedStudents).map(([classLabel, classStudents]) => (
            <div key={classLabel}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">Class {classLabel}</h2>
                <span className="text-sm text-[#1a1a1a]/50">{classStudents.length} students</span>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#B8860B]/10 overflow-hidden">
                {classStudents.map((student, index) => {
                  const houseColor = houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a'
                  return (
                    <div
                      key={student.id}
                      onClick={() => router.push(`/dashboard/students/${student.id}`)}
                      data-testid="student-row"
                      className={`flex items-center gap-4 p-4 cursor-pointer transition-all ${
                        index !== classStudents.length - 1 ? 'border-b border-[#1a1a1a]/5' : ''
                      } hover:bg-[#faf9f7]`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: `${houseColor}15`,
                          color: houseColor,
                        }}
                      >
                        {getInitials(student.name)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[#1a1a1a]" data-testid="student-name">{student.name}</p>
                        <div className="flex items-center gap-2 text-sm text-[#1a1a1a]/50">
                          <span>Grade {student.grade}{student.section}</span>
                          <span className="text-[#1a1a1a]/20">•</span>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: houseColor }}
                          />
                          <span>{canonicalHouseName(student.house, schoolHouses)?.replace('House of ', '')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#1a1a1a]">
                          {student.points === null ? '—' : student.points}
                        </p>
                        <p className="text-xs text-[#1a1a1a]/40">points</p>
                      </div>
                      <svg className="w-5 h-5 text-[#1a1a1a]/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedStudents).length === 0 && (
            <div
              className="bg-white rounded-2xl p-8 text-center border border-[#B8860B]/10"
              data-testid="students-empty-state"
            >
              <p className="text-[#1a1a1a]/50">No students found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
