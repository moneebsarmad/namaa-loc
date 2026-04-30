const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_BULK_STUDENTS = 100
const MAX_NOTES_LENGTH = 2000

type StudentPayload = {
  id: string
  name: string
  grade: number
  section: string
  house: string
}

type StudentsAwardPayload = {
  mode: 'students'
  categoryId: string
  domainId?: number
  students: StudentPayload[]
  notes?: string
  eventDate?: string
}

type HouseCompetitionPayload = {
  mode: 'house_competition'
  house: string
  points: number
  notes?: string
  eventDate?: string
}

export type AwardPayload = StudentsAwardPayload | HouseCompetitionPayload

export function validateAwardPayload(payload: unknown): { ok: true } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid payload.' }
  }

  const value = payload as Partial<AwardPayload>
  if (value.mode !== 'students' && value.mode !== 'house_competition') {
    return { ok: false, error: 'Invalid payload.' }
  }

  if (typeof value.notes === 'string' && value.notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `Notes exceed maximum length (${MAX_NOTES_LENGTH}).` }
  }

  if (value.eventDate && !ISO_DATE_PATTERN.test(value.eventDate)) {
    return { ok: false, error: 'eventDate must use YYYY-MM-DD format.' }
  }

  if (value.mode === 'house_competition') {
    const houseCompetition = value as Partial<HouseCompetitionPayload>
    if (!houseCompetition.house || typeof houseCompetition.house !== 'string') {
      return { ok: false, error: 'House is required.' }
    }
    if (!Number.isFinite(houseCompetition.points) || Number(houseCompetition.points) <= 0) {
      return { ok: false, error: 'Points must be a positive number.' }
    }
    return { ok: true }
  }

  const studentAward = value as Partial<StudentsAwardPayload>

  if (!studentAward.categoryId || typeof studentAward.categoryId !== 'string') {
    return { ok: false, error: 'Students and category are required.' }
  }

  if (!Array.isArray(studentAward.students) || studentAward.students.length === 0) {
    return { ok: false, error: 'Students and category are required.' }
  }

  if (studentAward.students.length > MAX_BULK_STUDENTS) {
    return { ok: false, error: `Cannot award points to more than ${MAX_BULK_STUDENTS} students at once.` }
  }

  const seen = new Set<string>()
  for (const student of studentAward.students) {
    if (!student || typeof student !== 'object') {
      return { ok: false, error: 'Each student entry must be valid.' }
    }
    const s = student as StudentPayload
    const studentId = String(s.id || '').trim()
    if (!studentId) {
      return { ok: false, error: 'Student id is required.' }
    }
    const key = studentId.toLowerCase()
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate student entry detected for ${s.name}.` }
    }
    seen.add(key)
    if (!String(s.name || '').trim()) {
      return { ok: false, error: 'Student name is required.' }
    }
    if (!Number.isFinite(Number(s.grade))) {
      return { ok: false, error: `Invalid grade for ${s.name}.` }
    }
  }

  return { ok: true }
}
