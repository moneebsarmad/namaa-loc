import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { Tables } from '@/lib/supabase/tables'
import { getSchoolDays } from '@/lib/schoolDays'
import { canonicalHouseName } from '@/lib/schoolHouses'

/**
 * Analytics Calculator Service
 *
 * Calculates comprehensive analytics metrics for the Tier 2 dashboard including:
 * - Staff participation rates
 * - Point economy health
 * - Category balance
 * - House distribution
 * - Composite health scores
 */

// Types
export type MeritRow = {
  staff_name: string | null
  student_name: string | null
  grade: number | null
  section: string | null
  house: string | null
  r: string | null
  subcategory: string | null
  points: number | null
  notes: string | null
  date_of_event: string | null
  timestamp: string | null
}

export type StaffRow = {
  staff_name: string | null
  email: string | null
  house: string | null
  grade_assignment?: string | null
  grade?: string | null
  department?: string | null
}

export type HealthStatus = 'GREEN' | 'AMBER' | 'RED'

export type AnalyticsSnapshot = {
  school_id: string
  snapshot_date: string
  snapshot_type: 'daily' | 'weekly' | 'monthly'
  staff_participation_rate: number | null
  active_staff_count: number
  total_staff_count: number
  points_per_student_avg: number | null
  points_per_staff_avg: number | null
  total_points_awarded: number
  total_transactions: number
  category_respect_pct: number | null
  category_responsibility_pct: number | null
  category_righteousness_pct: number | null
  category_other_pct: number | null
  house_balance_variance: number | null
  house_points: Record<string, number>
  overall_health_score: number
  status: HealthStatus
  participation_score: number
  category_balance_score: number
  house_balance_score: number
  consistency_score: number
  participation_change: number | null
  points_change: number | null
}

export type StaffAnalyticsData = {
  school_id: string
  staff_email: string
  staff_name: string | null
  analysis_date: string
  analysis_period: 'daily' | 'weekly' | 'monthly'
  points_given_period: number
  points_given_total: number
  active_days_period: number
  participation_streak_days: number
  days_since_last_point: number | null
  favorite_category: string | null
  category_distribution: Record<string, number>
  house_bias_coefficient: number | null
  house_distribution: Record<string, number>
  favored_house: string | null
  outlier_flag: boolean
  outlier_reason: string | null
  z_score: number | null
  school_avg_points: number | null
  department_avg_points: number | null
}

// Helper functions
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getEntryDate(row: MeritRow): string {
  if (row.date_of_event) return row.date_of_event
  if (row.timestamp) {
    const parsed = new Date(row.timestamp)
    if (Number.isFinite(parsed.getTime())) {
      return toDateString(parsed)
    }
  }
  return ''
}

function getThreeRCategory(value: string): string {
  const raw = (value || '').toLowerCase()
  if (raw.includes('respect')) return 'Respect'
  if (raw.includes('responsibility')) return 'Responsibility'
  if (raw.includes('righteousness')) return 'Righteousness'
  return 'Other'
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquaredDiff)
}

function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const stdDev = calculateStandardDeviation(values)
  return (stdDev / mean) * 100
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 80) return 'GREEN'
  if (score >= 60) return 'AMBER'
  return 'RED'
}

type HouseRow = {
  display_name: string | null
}

async function loadSchoolHouseNames(schoolId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('houses')
    .select('display_name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    throw error
  }

  return ((data || []) as HouseRow[])
    .map((row) => String(row.display_name ?? '').trim())
    .filter(Boolean)
}

/**
 * Calculate staff participation metrics
 */
export async function calculateStaffParticipation(
  startDate: string,
  endDate: string,
  schoolId: string
): Promise<{
  participationRate: number | null
  activeStaffCount: number
  totalStaffCount: number
  activeStaffList: string[]
  inactiveStaffList: string[]
  avgPointsPerStaff: number | null
  staffMetrics: Map<string, { points: number; activeDays: number; lastActive: string }>
}> {
  const supabase = getSupabaseAdmin()

  const [staffRes, entriesRes] = await Promise.all([
    supabase.from(Tables.staff).select('*').eq('school_id', schoolId),
    supabase
      .from(Tables.meritLog)
      .select('*')
      .eq('school_id', schoolId)
      .gte('date_of_event', startDate)
      .lte('date_of_event', endDate),
  ])

  if (staffRes.error) throw staffRes.error
  if (entriesRes.error) throw entriesRes.error

  const staffRows = (staffRes.data || []) as StaffRow[]
  const entries = (entriesRes.data || []) as MeritRow[]

  const staffRoster = new Map<string, StaffRow>()
  staffRows.forEach((row) => {
    const name = String(row.staff_name ?? '').trim().toLowerCase()
    if (name) staffRoster.set(name, row)
  })

  const staffMetrics = new Map<string, { points: number; activeDays: Set<string>; lastActive: string }>()

  // Initialize all staff
  staffRows.forEach((row) => {
    const name = String(row.staff_name ?? '').trim().toLowerCase()
    if (name) {
      staffMetrics.set(name, { points: 0, activeDays: new Set(), lastActive: '' })
    }
  })

  // Process entries
  entries.forEach((entry) => {
    const staffName = String(entry.staff_name ?? '').trim().toLowerCase()
    if (!staffName) return

    let metrics = staffMetrics.get(staffName)
    if (!metrics) {
      metrics = { points: 0, activeDays: new Set(), lastActive: '' }
      staffMetrics.set(staffName, metrics)
    }

    metrics.points += Number(entry.points ?? 0) || 0
    const entryDate = getEntryDate(entry)
    if (entryDate) {
      metrics.activeDays.add(entryDate)
      if (!metrics.lastActive || entryDate > metrics.lastActive) {
        metrics.lastActive = entryDate
      }
    }
  })

  const totalStaffCount = staffRows.length
  const activeStaffList: string[] = []
  const inactiveStaffList: string[] = []

  staffMetrics.forEach((metrics, name) => {
    if (metrics.points > 0) {
      activeStaffList.push(name)
    } else {
      inactiveStaffList.push(name)
    }
  })

  const activeStaffCount = activeStaffList.length
  const participationRate = totalStaffCount > 0 ? (activeStaffCount / totalStaffCount) * 100 : null

  const totalPoints = Array.from(staffMetrics.values()).reduce((sum, m) => sum + m.points, 0)
  const avgPointsPerStaff = activeStaffCount > 0 ? totalPoints / activeStaffCount : null

  // Convert to serializable format
  const serializedMetrics = new Map<string, { points: number; activeDays: number; lastActive: string }>()
  staffMetrics.forEach((m, name) => {
    serializedMetrics.set(name, {
      points: m.points,
      activeDays: m.activeDays.size,
      lastActive: m.lastActive,
    })
  })

  return {
    participationRate,
    activeStaffCount,
    totalStaffCount,
    activeStaffList,
    inactiveStaffList,
    avgPointsPerStaff,
    staffMetrics: serializedMetrics,
  }
}

/**
 * Calculate point economy metrics
 */
export async function calculatePointEconomy(
  startDate: string,
  endDate: string,
  schoolId: string
): Promise<{
  totalPoints: number
  totalTransactions: number
  pointsPerStudent: number | null
  pointsPerStaff: number | null
  avgPointsPerTransaction: number | null
  weeklyTrend: { week: string; points: number }[]
}> {
  const supabase = getSupabaseAdmin()

  const [entriesRes, studentsRes, staffRes] = await Promise.all([
    supabase
      .from(Tables.meritLog)
      .select('*')
      .eq('school_id', schoolId)
      .gte('date_of_event', startDate)
      .lte('date_of_event', endDate),
    supabase.from(Tables.students).select('*').eq('school_id', schoolId),
    supabase.from(Tables.staff).select('*').eq('school_id', schoolId),
  ])

  if (entriesRes.error) {
    console.error('Merit log error:', entriesRes.error)
    throw entriesRes.error
  }
  // Students table may not exist - handle gracefully
  if (studentsRes.error && studentsRes.error.code !== '42P01') {
    console.error('Students error:', studentsRes.error)
    throw studentsRes.error
  }
  if (staffRes.error) {
    console.error('Staff error:', staffRes.error)
    throw staffRes.error
  }

  const entries = (entriesRes.data || []) as MeritRow[]
  const studentCount = studentsRes.data?.length || 0

  const totalPoints = entries.reduce((sum, e) => sum + (Number(e.points ?? 0) || 0), 0)
  const totalTransactions = entries.length

  const activeStaff = new Set(entries.map((e) => e.staff_name).filter(Boolean))

  const pointsPerStudent = studentCount > 0 ? totalPoints / studentCount : null
  const pointsPerStaff = activeStaff.size > 0 ? totalPoints / activeStaff.size : null
  const avgPointsPerTransaction = totalTransactions > 0 ? totalPoints / totalTransactions : null

  // Calculate weekly trend
  const weeklyPoints = new Map<string, number>()
  entries.forEach((entry) => {
    const date = getEntryDate(entry)
    if (!date) return
    const weekStart = toDateString(
      addDays(parseDate(date), -parseDate(date).getUTCDay())
    )
    weeklyPoints.set(weekStart, (weeklyPoints.get(weekStart) || 0) + (Number(entry.points ?? 0) || 0))
  })

  const weeklyTrend = Array.from(weeklyPoints.entries())
    .map(([week, points]) => ({ week, points }))
    .sort((a, b) => a.week.localeCompare(b.week))

  return {
    totalPoints,
    totalTransactions,
    pointsPerStudent,
    pointsPerStaff,
    avgPointsPerTransaction,
    weeklyTrend,
  }
}

/**
 * Calculate category balance metrics
 */
export async function calculateCategoryBalance(
  startDate: string,
  endDate: string,
  schoolId: string
): Promise<{
  categoryDistribution: Record<string, number>
  categoryPercentages: Record<string, number>
  dominantCategory: string | null
  isBalanced: boolean
  balanceScore: number
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.meritLog)
    .select('*')
    .eq('school_id', schoolId)
    .gte('date_of_event', startDate)
    .lte('date_of_event', endDate)

  if (error) throw error

  const entries = (data || []) as MeritRow[]

  const categoryDistribution: Record<string, number> = {
    Respect: 0,
    Responsibility: 0,
    Righteousness: 0,
    Other: 0,
  }

  entries.forEach((entry) => {
    const category = getThreeRCategory(String(entry.r ?? ''))
    const points = Number(entry.points ?? 0) || 0
    categoryDistribution[category] = (categoryDistribution[category] || 0) + points
  })

  const totalPoints = Object.values(categoryDistribution).reduce((a, b) => a + b, 0)

  const categoryPercentages: Record<string, number> = {}
  Object.keys(categoryDistribution).forEach((cat) => {
    categoryPercentages[cat] = totalPoints > 0 ? (categoryDistribution[cat] / totalPoints) * 100 : 0
  })

  // Find dominant category (excluding Other)
  const threeRs = ['Respect', 'Responsibility', 'Righteousness']
  let dominantCategory: string | null = null
  let maxPct = 0
  threeRs.forEach((cat) => {
    if (categoryPercentages[cat] > maxPct) {
      maxPct = categoryPercentages[cat]
      dominantCategory = cat
    }
  })

  // Check if balanced (each 3R should be 25-40%, allowing some variance)
  const isBalanced = threeRs.every(
    (cat) => categoryPercentages[cat] >= 20 && categoryPercentages[cat] <= 50
  )

  // Calculate balance score (0-100)
  // Perfect balance would be 33.3% each for 3Rs
  const idealPct = 100 / 3
  const threeRTotal = threeRs.reduce((sum, cat) => sum + categoryPercentages[cat], 0)
  const normalizedPcts = threeRs.map((cat) =>
    threeRTotal > 0 ? (categoryPercentages[cat] / threeRTotal) * 100 : 0
  )
  const deviations = normalizedPcts.map((pct) => Math.abs(pct - idealPct))
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / 3
  const balanceScore = Math.max(0, Math.min(100, 100 - avgDeviation * 3))

  return {
    categoryDistribution,
    categoryPercentages,
    dominantCategory,
    isBalanced,
    balanceScore,
  }
}

/**
 * Calculate house distribution metrics
 */
export async function calculateHouseDistribution(
  startDate: string,
  endDate: string,
  schoolId: string
): Promise<{
  housePoints: Record<string, number>
  housePercentages: Record<string, number>
  variance: number
  isBalanced: boolean
  balanceScore: number
}> {
  const supabase = getSupabaseAdmin()
  const houseNames = await loadSchoolHouseNames(schoolId)

  const { data, error } = await supabase
    .from(Tables.meritLog)
    .select('*')
    .eq('school_id', schoolId)
    .gte('date_of_event', startDate)
    .lte('date_of_event', endDate)

  if (error) throw error

  const entries = (data || []) as MeritRow[]

  const housePoints: Record<string, number> = {}
  houseNames.forEach((house) => {
    housePoints[house] = 0
  })

  entries.forEach((entry) => {
    const house = canonicalHouseName(String(entry.house ?? '').trim())
    if (house && housePoints[house] !== undefined) {
      housePoints[house] += Number(entry.points ?? 0) || 0
    }
  })

  const totalPoints = Object.values(housePoints).reduce((a, b) => a + b, 0)

  const housePercentages: Record<string, number> = {}
  Object.keys(housePoints).forEach((house) => {
    housePercentages[house] = totalPoints > 0 ? (housePoints[house] / totalPoints) * 100 : 0
  })

  // Calculate coefficient of variation
  const values = Object.values(housePoints)
  const variance = calculateCoefficientOfVariation(values)

  // Check if balanced (variance < 25%)
  const isBalanced = variance < 25

  // Calculate balance score
  const balanceScore = Math.max(0, Math.min(100, 100 - variance * 2))

  return {
    housePoints,
    housePercentages,
    variance,
    isBalanced,
    balanceScore,
  }
}

/**
 * Calculate composite health score
 */
export function calculateCompositeHealthScore(
  participationRate: number | null,
  categoryBalanceScore: number,
  houseBalanceScore: number,
  consistencyScore: number
): { score: number; status: HealthStatus } {
  // Weight distribution:
  // - Participation: 40%
  // - Category Balance: 30%
  // - House Balance: 20%
  // - Consistency: 10%

  const participationScore = participationRate !== null ? Math.min(100, participationRate * 1.25) : 0
  const weightedParticipation = participationScore * 0.4
  const weightedCategory = categoryBalanceScore * 0.3
  const weightedHouse = houseBalanceScore * 0.2
  const weightedConsistency = consistencyScore * 0.1

  const score = Math.round(weightedParticipation + weightedCategory + weightedHouse + weightedConsistency)
  const status = getHealthStatus(score)

  return { score, status }
}

/**
 * Calculate consistency score based on day-to-day point giving patterns
 */
export async function calculateConsistencyScore(
  startDate: string,
  endDate: string,
  schoolId: string
): Promise<number> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.meritLog)
    .select('*')
    .eq('school_id', schoolId)
    .gte('date_of_event', startDate)
    .lte('date_of_event', endDate)

  if (error) throw error

  const entries = (data || []) as MeritRow[]

  // Count entries per day
  const dailyCounts = new Map<string, number>()
  entries.forEach((entry) => {
    const date = getEntryDate(entry)
    if (date) {
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
    }
  })

  // Get school days in range
  const schoolDays = getSchoolDays(startDate, endDate)

  if (schoolDays.length === 0) return 50 // Default score if no school days

  // Calculate what percentage of school days had activity
  const activeDays = schoolDays.filter((day: string) => dailyCounts.has(day)).length
  const activityRate = (activeDays / schoolDays.length) * 100

  // Calculate variance in daily counts
  const counts = schoolDays.map((day: string) => dailyCounts.get(day) || 0)
  const cv = calculateCoefficientOfVariation(counts)

  // Score based on activity rate (60%) and low variance (40%)
  const activityScore = Math.min(100, activityRate * 1.25)
  const varianceScore = Math.max(0, 100 - cv)

  return Math.round(activityScore * 0.6 + varianceScore * 0.4)
}

/**
 * Generate a complete analytics snapshot
 */
export async function generateAnalyticsSnapshot(
  startDate: string,
  endDate: string,
  schoolId: string,
  snapshotType: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<AnalyticsSnapshot> {
  const [participation, economy, categoryBalance, houseDistribution, consistency] = await Promise.all([
    calculateStaffParticipation(startDate, endDate, schoolId),
    calculatePointEconomy(startDate, endDate, schoolId),
    calculateCategoryBalance(startDate, endDate, schoolId),
    calculateHouseDistribution(startDate, endDate, schoolId),
    calculateConsistencyScore(startDate, endDate, schoolId),
  ])

  const participationScore = participation.participationRate !== null
    ? Math.min(100, participation.participationRate * 1.25)
    : 0

  const { score: healthScore, status } = calculateCompositeHealthScore(
    participation.participationRate,
    categoryBalance.balanceScore,
    houseDistribution.balanceScore,
    consistency
  )

  return {
    school_id: schoolId,
    snapshot_date: endDate,
    snapshot_type: snapshotType,
    staff_participation_rate: participation.participationRate,
    active_staff_count: participation.activeStaffCount,
    total_staff_count: participation.totalStaffCount,
    points_per_student_avg: economy.pointsPerStudent,
    points_per_staff_avg: economy.pointsPerStaff,
    total_points_awarded: economy.totalPoints,
    total_transactions: economy.totalTransactions,
    category_respect_pct: categoryBalance.categoryPercentages.Respect,
    category_responsibility_pct: categoryBalance.categoryPercentages.Responsibility,
    category_righteousness_pct: categoryBalance.categoryPercentages.Righteousness,
    category_other_pct: categoryBalance.categoryPercentages.Other,
    house_balance_variance: houseDistribution.variance,
    house_points: houseDistribution.housePoints,
    overall_health_score: healthScore,
    status,
    participation_score: Math.round(participationScore),
    category_balance_score: Math.round(categoryBalance.balanceScore),
    house_balance_score: Math.round(houseDistribution.balanceScore),
    consistency_score: consistency,
    participation_change: null, // Will be calculated by comparing with previous snapshot
    points_change: null,
  }
}

/**
 * Save analytics snapshot to database
 */
export async function saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase.from(Tables.analyticsSnapshots).upsert(
    {
      ...snapshot,
      house_points: snapshot.house_points,
    },
    { onConflict: 'school_id,snapshot_date,snapshot_type' }
  )

  if (error) throw error
}

/**
 * Get the most recent analytics snapshot
 */
export async function getLatestSnapshot(
  schoolId: string,
  snapshotType: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<AnalyticsSnapshot | null> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.analyticsSnapshots)
    .select('*')
    .eq('school_id', schoolId)
    .eq('snapshot_type', snapshotType)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as AnalyticsSnapshot | null
}

/**
 * Get snapshot history for trend analysis
 */
export async function getSnapshotHistory(
  schoolId: string,
  snapshotType: 'daily' | 'weekly' | 'monthly',
  limit: number = 30
): Promise<AnalyticsSnapshot[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.analyticsSnapshots)
    .select('*')
    .eq('school_id', schoolId)
    .eq('snapshot_type', snapshotType)
    .order('snapshot_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as AnalyticsSnapshot[]
}
