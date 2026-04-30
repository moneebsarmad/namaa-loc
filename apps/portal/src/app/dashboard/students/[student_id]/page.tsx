'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import CrestLoader from '../../../../components/CrestLoader'
import { ROLES } from '../../../../lib/permissions'
import { useUserProfile, useUserRole } from '../../../../hooks/usePermissions'
import { AccessDenied } from '@/components/PermissionGate'
import { canBrowseStudentDirectory } from '@/lib/portalRoles'
import { canonicalHouseName, getHouseColors } from '@/lib/schoolHouses'
import { useSchoolHouses } from '@/hooks/useSchoolHouses'

interface StudentProfile {
  id: string
  name: string
  grade: number
  section: string
  house: string
  email?: string
}

interface MeritEntry {
  id: string
  points: number
  r: string
  subcategory: string
  timestamp: string
  dateOfEvent: string
  staffName: string
  notes: string
}

function formatDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export default function StudentDetailPage() {
  const params = useParams()
  const studentId = Array.isArray(params?.student_id) ? params.student_id[0] : params?.student_id
  const { role, loading: roleLoading } = useUserRole()
  const { profile, loading: profileLoading } = useUserProfile()
  const currentSchoolId = profile?.school_id ?? null
  const { houses: schoolHouses, loading: housesLoading } = useSchoolHouses(Boolean(currentSchoolId))
  const isParent = role === ROLES.PARENT
  const canBrowseDirectory = canBrowseStudentDirectory(profile?.role ?? null)
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [merits, setMerits] = useState<MeritEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId || roleLoading || profileLoading) return
    if (!currentSchoolId) {
      setLoading(false)
      return
    }
    if (!isParent && !canBrowseDirectory) {
      setLoading(false)
      return
    }

    const fetchStudent = async () => {
      setLoading(true)
      setError(null)

      try {
        const [studentRes, meritsRes] = await Promise.all([
          supabase
            .from('students')
            .select('student_id, student_name, grade, section, house, student_email')
            .eq('student_id', studentId)
            .eq('school_id', currentSchoolId)
            .maybeSingle(),
          supabase
            .from(isParent ? 'merit_log_parent' : 'merit_log')
            .select('id, points, r, subcategory, timestamp, date_of_event, staff_name, notes')
            .eq('student_id', studentId)
            .eq('school_id', currentSchoolId)
            .order('date_of_event', { ascending: false }),
        ])

        if (studentRes.error) throw studentRes.error
        if (meritsRes.error) throw meritsRes.error

        const studentRow = studentRes.data
        if (!studentRow?.student_id) {
          setStudent(null)
          setMerits([])
          setLoading(false)
          return
        }

        setStudent({
          id: String(studentRow.student_id ?? ''),
          name: String(studentRow.student_name ?? ''),
          grade: Number(studentRow.grade ?? 0),
          section: String(studentRow.section ?? ''),
          house: String(studentRow.house ?? ''),
          email: studentRow.student_email ? String(studentRow.student_email) : undefined,
        })

        setMerits(
          (meritsRes.data || []).map((row) => ({
            id: String(row.id ?? ''),
            points: Number(row.points ?? 0),
            r: String(row.r ?? ''),
            subcategory: String(row.subcategory ?? ''),
            timestamp: String(row.timestamp ?? ''),
            dateOfEvent: String(row.date_of_event ?? ''),
            staffName: String(row.staff_name ?? ''),
            notes: String(row.notes ?? ''),
          }))
        )
      } catch (fetchError) {
        console.error('Error loading student details:', fetchError)
        setError('Unable to load student details.')
      } finally {
        setLoading(false)
      }
    }

    fetchStudent()
  }, [canBrowseDirectory, currentSchoolId, isParent, profileLoading, roleLoading, studentId])

  const totalPoints = useMemo(() => merits.reduce((sum, entry) => sum + entry.points, 0), [merits])

  if (loading || roleLoading || profileLoading || housesLoading) {
    return <CrestLoader label="Loading student details..." />
  }

  if (!isParent && !canBrowseDirectory) {
    return <AccessDenied message="Student detail access is limited to admins and house mentors." />
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#B8860B]/10">
        <p className="text-[#1a1a1a] font-semibold mb-2">Unable to load student</p>
        <p className="text-[#1a1a1a]/60 text-sm">{error}</p>
        <Link href="/dashboard/students" className="inline-flex mt-4 text-sm text-[#B8860B] font-medium">
          Back to Students
        </Link>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#B8860B]/10">
        <p className="text-[#1a1a1a] font-semibold mb-2">Student not found</p>
        <p className="text-[#1a1a1a]/60 text-sm">We could not find a student record for this account.</p>
        <Link href="/dashboard/students" className="inline-flex mt-4 text-sm text-[#B8860B] font-medium">
          Back to Students
        </Link>
      </div>
    )
  }

  const houseColors = getHouseColors(schoolHouses)
  const houseColor = houseColors[canonicalHouseName(student.house, schoolHouses)] || '#1a1a1a'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/students" className="text-sm text-[#1a1a1a]/60 hover:text-[#1a1a1a]">
            {'<- Back to Students'}
          </Link>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mt-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {student.name}
          </h1>
          <p className="text-[#1a1a1a]/60 text-sm mt-2">
            Grade {student.grade}{student.section} - {canonicalHouseName(student.house, schoolHouses)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-[#1a1a1a]/50">Total Points</div>
          <div className="text-3xl font-bold" style={{ color: houseColor }}>{totalPoints}</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Merit History</h2>
          {merits.length === 0 ? (
            <div className="text-sm text-[#1a1a1a]/50">No merit entries found.</div>
          ) : (
            <div className="space-y-4">
              {merits.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 border-b border-[#1a1a1a]/5 pb-4 last:border-b-0 last:pb-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[#1a1a1a]" style={{ backgroundColor: `${houseColor}15`, color: houseColor }}>
                    +{entry.points}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1a1a1a]">
                        {entry.r ? `${entry.r} - ` : ''}{entry.subcategory || 'Merit'}
                      </p>
                      <span className="text-xs text-[#1a1a1a]/40">
                        {formatDate(entry.dateOfEvent || entry.timestamp)}
                      </span>
                    </div>
                    {entry.staffName && (
                      <p className="text-xs text-[#1a1a1a]/50 mt-1">Awarded by {entry.staffName}</p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-[#1a1a1a]/50 mt-1">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#B8860B]/10">
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Student Details</h2>
          <div className="space-y-3 text-sm text-[#1a1a1a]/70">
            <div className="flex items-center justify-between">
              <span>Name</span>
              <span className="font-medium text-[#1a1a1a]">{student.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Grade</span>
              <span className="font-medium text-[#1a1a1a]">{student.grade}{student.section}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>House</span>
              <span className="font-medium text-[#1a1a1a]">{canonicalHouseName(student.house, schoolHouses)}</span>
            </div>
            {student.email && (
              <div className="flex items-center justify-between">
                <span>Email</span>
                <span className="font-medium text-[#1a1a1a]">{student.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
