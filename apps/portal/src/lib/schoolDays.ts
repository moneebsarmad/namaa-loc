type SchoolDayOptions = {
  excludeWeekends?: boolean
  calendarDates?: string[]
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function isWeekend(date: Date) {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export function getSchoolDays(startDate: string, endDate: string, options: SchoolDayOptions = {}) {
  const { excludeWeekends = true, calendarDates } = options
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return [] as string[]
  }

  if (Array.isArray(calendarDates) && calendarDates.length > 0) {
    const rangeStart = toDateString(start)
    const rangeEnd = toDateString(end)
    return calendarDates
      .filter((date) => date >= rangeStart && date <= rangeEnd)
      .sort()
  }

  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    if (!excludeWeekends || !isWeekend(cursor)) {
      days.push(toDateString(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}
