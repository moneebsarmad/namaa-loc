type ViewRow = Record<string, unknown>

export type NormalizedStandingRow = {
  house: string
  totalPoints: number
}

export type NormalizedTopStudentRow = {
  house: string
  studentName: string
  totalPoints: number
  rank: number | null
}

export function getLeaderboardViewValue(row: ViewRow, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) {
      return row[key]
    }
  }

  const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[key.toLowerCase()] = key
    return acc
  }, {})

  for (const key of keys) {
    const normalized = normalizedKeys[key.toLowerCase()]
    if (normalized) {
      return row[normalized]
    }
  }

  return undefined
}

function toTrimmedString(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizeHouseStandingsRows(rows: ViewRow[]): NormalizedStandingRow[] {
  return rows
    .map((row) => ({
      house: toTrimmedString(getLeaderboardViewValue(row, ['house', 'house_name'])),
      totalPoints: Number(getLeaderboardViewValue(row, ['total_points', 'points'])) || 0,
    }))
    .filter((row) => row.house.length > 0)
}

export function normalizeTopStudentsRows(rows: ViewRow[]): NormalizedTopStudentRow[] {
  return rows
    .map((row) => {
      const rankRaw = getLeaderboardViewValue(row, ['house_rank', 'rank'])
      const rank = Number(rankRaw)

      return {
        house: toTrimmedString(getLeaderboardViewValue(row, ['house', 'house_name'])),
        studentName: toTrimmedString(getLeaderboardViewValue(row, ['student_name', 'student', 'name'])) || 'Unnamed Student',
        totalPoints: Number(getLeaderboardViewValue(row, ['total_points', 'points'])) || 0,
        rank: Number.isFinite(rank) ? rank : null,
      }
    })
    .filter((row) => row.house.length > 0)
}
