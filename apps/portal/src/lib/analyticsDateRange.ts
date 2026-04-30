function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && toDateString(parsed) === value
}

export type DateRangeResolution =
  | { ok: true; startDate: string; endDate: string }
  | { ok: false; error: string }

export function resolveAnalyticsDateRange(
  startDate: string | null,
  endDate: string | null,
  defaultDays: number,
  now = new Date()
): DateRangeResolution {
  const defaultEndDate = toDateString(now)
  const defaultStartDate = toDateString(addDays(now, -defaultDays))

  const effectiveStartDate = startDate || defaultStartDate
  const effectiveEndDate = endDate || defaultEndDate

  if (!isValidDateString(effectiveStartDate)) {
    return { ok: false, error: 'Invalid startDate.' }
  }

  if (!isValidDateString(effectiveEndDate)) {
    return { ok: false, error: 'Invalid endDate.' }
  }

  if (effectiveStartDate > effectiveEndDate) {
    return { ok: false, error: 'startDate must be on or before endDate.' }
  }

  return {
    ok: true,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
  }
}
