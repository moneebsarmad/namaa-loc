import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

import { withSchoolScope } from '@namaa-loc/db/auth.server'
import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

import { requireAuthenticatedUser } from '@/lib/apiAuth'
import { writeAuditLog } from '@/lib/audit'
import { canUseStudentLookup, isHouseMentorRole } from '@/lib/portalRoles'
import { validateAwardPayload, type AwardPayload } from '@/lib/pointsAwardValidation'

type CachedAwardResponse = {
  status: number
  body: unknown
}

const AWARD_REQUEST_TTL_MS = 30_000
const awardRequestCache = new Map<
  string,
  {
    expiresAt: number
    inFlight?: Promise<CachedAwardResponse>
    result?: CachedAwardResponse
  }
>()

function cleanupAwardRequestCache() {
  const now = Date.now()
  for (const [key, entry] of awardRequestCache.entries()) {
    if (entry.expiresAt <= now) {
      awardRequestCache.delete(key)
    }
  }
}

function buildAwardRequestKey(userId: string, rawBody: string) {
  return createHash('sha256').update(`${userId}:${rawBody}`).digest('hex')
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return { error: 'Unexpected response body.' }
  }
}

function toCachedJsonResponse(result: CachedAwardResponse) {
  return NextResponse.json(result.body, { status: result.status })
}

async function runCachedAwardRequest(key: string, execute: () => Promise<Response>) {
  cleanupAwardRequestCache()

  const existing = awardRequestCache.get(key)
  if (existing?.result) {
    return toCachedJsonResponse(existing.result)
  }

  if (existing?.inFlight) {
    const result = await existing.inFlight
    return toCachedJsonResponse(result)
  }

  const inFlight = (async () => {
    const response = await execute()
    const result = {
      status: response.status,
      body: await readResponseBody(response),
    }
    awardRequestCache.set(key, {
      expiresAt: Date.now() + AWARD_REQUEST_TTL_MS,
      result,
    })
    return result
  })().catch((error) => {
    awardRequestCache.delete(key)
    throw error
  })

  awardRequestCache.set(key, {
    expiresAt: Date.now() + AWARD_REQUEST_TTL_MS,
    inFlight,
  })

  const result = await inFlight
  return toCachedJsonResponse(result)
}

const resolveStaff = async (
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  user: Pick<User, 'id' | 'email' | 'user_metadata'>,
  userId: string,
  email: string,
  linkedStaffId: string | null,
  schoolId: string
) => {
  if (linkedStaffId) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, staff_name, email')
      .eq('school_id', schoolId)
      .eq('id', linkedStaffId)
      .maybeSingle()

    const staffName = String(staff?.staff_name ?? '').trim()
    if (staffName) {
      return { staffId: staff?.id ?? linkedStaffId, staffName }
    }
  }

  if (email) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('school_id', schoolId)
      .ilike('email', email)
      .maybeSingle()

    const staffName = String(staff?.staff_name ?? '').trim()
    if (staffName) {
      return { staffId: staff?.id ?? null, staffName }
    }
  }

  const metadataFullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim()
  const emailFallback = email
    ? email
        .split('@')[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : ''
  const staffName = metadataFullName || emailFallback || (userId ? `Staff ${userId.slice(0, 8)}` : '')

  return { staffId: userId || null, staffName }
}

export async function POST(request: Request) {
  try {
    return await withSchoolScope(async (schoolId) => {
      const auth = await requireAuthenticatedUser()
      if (auth.error || !auth.supabase || !auth.user) {
        return auth.error ?? NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
      }

      const supabaseAdmin = createSupabaseServiceRoleClient()
      const user = auth.user
      const rawBody = await request.text()
      const requestKey = buildAwardRequestKey(user.id, rawBody)

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role, assigned_house, linked_staff_id, school_id')
        .eq('id', user.id)
        .eq('school_id', schoolId)
        .maybeSingle()

      if (profileError) {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 })
      }

      const role = profile?.role ?? null
      if (!canUseStudentLookup(role)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const assignedHouse = profile?.assigned_house ?? null
      const linkedStaffId = profile?.linked_staff_id ?? null
      if (isHouseMentorRole(role) && !assignedHouse) {
        return NextResponse.json({ error: 'House mentor account is missing an assigned house.' }, { status: 403 })
      }

      return await runCachedAwardRequest(requestKey, async () => {
        const payload = JSON.parse(rawBody) as AwardPayload
        const validation = validateAwardPayload(payload)
        if (!validation.ok) {
          return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        if (payload.mode === 'house_competition') {
          return NextResponse.json(
            { error: 'House competition awards are not supported in this demo schema.' },
            { status: 400 }
          )
        }

        const { data: category, error: categoryError } = await supabaseAdmin
          .from('3r_categories')
          .select('id, r, subcategory, points')
          .eq('id', payload.categoryId)
          .maybeSingle()

        if (categoryError || !category) {
          return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
        }

        const staff = await resolveStaff(supabaseAdmin, user, user.id, user.email ?? '', linkedStaffId, schoolId)
        if (!staff.staffName) {
          return NextResponse.json({ error: 'Unable to resolve staff name.' }, { status: 400 })
        }

        const requestedStudents = payload.students
        const requestedStudentIds = requestedStudents.map((student) => student.id)
        let studentQuery = supabaseAdmin
          .from('students')
          .select('student_id, student_name, grade, section, house, school_id')
          .eq('school_id', schoolId)
          .in('student_id', requestedStudentIds)

        if (assignedHouse && isHouseMentorRole(role)) {
          studentQuery = studentQuery.eq('house', assignedHouse)
        }

        const { data: studentRows, error: studentLookupError } = await studentQuery

        if (studentLookupError) {
          return NextResponse.json({ error: studentLookupError.message }, { status: 400 })
        }

        const studentMap = new Map(
          (studentRows || []).map((student) => [String(student.student_id), student])
        )

        const entries = []
        for (const student of requestedStudents) {
          const studentRow = studentMap.get(student.id)
          if (!studentRow?.student_id || String(studentRow.school_id) !== schoolId) {
            return NextResponse.json({ error: `Student not found: ${student.name}` }, { status: 400 })
          }

          entries.push({
            school_id: schoolId,
            student_id: studentRow.student_id,
            staff_id: staff.staffId,
            timestamp: new Date().toISOString(),
            date_of_event: payload.eventDate || new Date().toISOString().split('T')[0],
            student_name: studentRow.student_name,
            grade: studentRow.grade,
            section: studentRow.section,
            house: studentRow.house,
            r: category.r,
            subcategory: category.subcategory,
            points: category.points,
            notes: payload.notes || '',
            staff_name: staff.staffName,
            domain_id: payload.domainId || null,
          })
        }

        const { error } = await supabaseAdmin.from('merit_log').insert(entries)
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        await writeAuditLog({
          schoolId,
          actor: { id: user.id, email: user.email ?? null, role },
          action: 'points.award',
          targetType: 'merit_log',
          metadata: {
            inserted: entries.length,
            category: `${category.r}/${category.subcategory}`,
            points: category.points,
          },
          request,
        })

        return NextResponse.json({
          success: true,
          awarded: entries.length,
          points: category.points,
        })
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Missing school context.') {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 401 })
    }

    console.error('Error awarding points:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
