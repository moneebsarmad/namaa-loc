import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { Tables } from '@/lib/supabase/tables'
import { canonicalHouseName } from '@/lib/schoolHouses'

type HouseRow = {
  display_name: string | null
}

/**
 * Bias Detector Service
 *
 * Detects statistical biases in staff point-giving behavior:
 * - House favoritism (staff giving disproportionate points to specific houses)
 * - Category preferences (staff over-using certain categories)
 * - Outlier behavior (staff giving significantly more/fewer points than average)
 */

type MeritRow = {
  staff_name: string | null
  house: string | null
  r: string | null
  points: number | null
  date_of_event: string | null
}

type StaffRow = {
  staff_name: string | null
  email: string | null
  house: string | null
}

export type BiasAnalysis = {
  staffEmail: string
  staffName: string
  houseBiasCoefficient: number
  houseDistribution: Record<string, number>
  favoredHouse: string | null
  hasBias: boolean
  biasDescription: string | null
  categoryPreference: string | null
  categoryDistribution: Record<string, number>
}

export type OutlierAnalysis = {
  staffEmail: string
  staffName: string
  pointsGiven: number
  schoolAverage: number
  zScore: number
  isOutlier: boolean
  outlierType: 'high' | 'low' | null
  outlierReason: string | null
}

export type StaffAnalyticsRecord = {
  school_id: string
  staff_email: string
  staff_name: string | null
  analysis_date: string
  analysis_period: 'daily' | 'weekly' | 'monthly'
  points_given_period: number
  active_days_period: number
  favorite_category: string | null
  category_distribution: Record<string, number>
  house_bias_coefficient: number | null
  house_distribution: Record<string, number>
  favored_house: string | null
  outlier_flag: boolean
  outlier_reason: string | null
  z_score: number | null
  school_avg_points: number | null
}

// Chi-square calculation for bias detection
function calculateChiSquare(observed: number[], expected: number[]): number {
  if (observed.length !== expected.length) return 0

  let chiSquare = 0
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i]
    }
  }
  return chiSquare
}

// Convert chi-square to a bias coefficient (0-10 scale)
function chiSquareToBiasCoefficient(chiSquare: number, degreesOfFreedom: number): number {
  // Critical values for different significance levels
  // df=3 (4 houses - 1): 7.81 (0.05), 11.34 (0.01), 16.27 (0.001)
  const criticalValues: Record<number, { p05: number; p01: number; p001: number }> = {
    1: { p05: 3.84, p01: 6.63, p001: 10.83 },
    2: { p05: 5.99, p01: 9.21, p001: 13.82 },
    3: { p05: 7.81, p01: 11.34, p001: 16.27 },
    4: { p05: 9.49, p01: 13.28, p001: 18.47 },
  }

  const cv = criticalValues[degreesOfFreedom] || criticalValues[3]

  // Scale: 0-2 = no bias, 2-4 = mild, 4-6 = moderate, 6-8 = strong, 8-10 = extreme
  if (chiSquare < cv.p05) return chiSquare / cv.p05 * 2 // 0-2
  if (chiSquare < cv.p01) return 2 + ((chiSquare - cv.p05) / (cv.p01 - cv.p05)) * 2 // 2-4
  if (chiSquare < cv.p001) return 4 + ((chiSquare - cv.p01) / (cv.p001 - cv.p01)) * 2 // 4-6
  return Math.min(10, 6 + ((chiSquare - cv.p001) / cv.p001) * 4) // 6-10
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquaredDiff)
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

function getThreeRCategory(value: string): string {
  const raw = (value || '').toLowerCase()
  if (raw.includes('respect')) return 'Respect'
  if (raw.includes('responsibility')) return 'Responsibility'
  if (raw.includes('righteousness')) return 'Righteousness'
  return 'Other'
}

function getEntryDate(row: MeritRow): string {
  if (row.date_of_event) return row.date_of_event
  return ''
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
 * Analyze house bias for a single staff member
 */
export function analyzeStaffHouseBias(
  staffEntries: MeritRow[],
  schoolHouseDistribution: Record<string, number>,
  houseNames: string[]
): BiasAnalysis {
  const staffName = staffEntries[0]?.staff_name || 'Unknown'

  // Count points per house for this staff
  const staffHousePoints: Record<string, number> = {}
  houseNames.forEach((house) => {
    staffHousePoints[house] = 0
  })

  staffEntries.forEach((entry) => {
    const house = canonicalHouseName(String(entry.house ?? '').trim())
    if (house && staffHousePoints[house] !== undefined) {
      staffHousePoints[house] += Number(entry.points ?? 0) || 0
    }
  })

  const totalStaffPoints = Object.values(staffHousePoints).reduce((a, b) => a + b, 0)

  if (totalStaffPoints === 0) {
    return {
      staffEmail: '',
      staffName,
      houseBiasCoefficient: 0,
      houseDistribution: staffHousePoints,
      favoredHouse: null,
      hasBias: false,
      biasDescription: null,
      categoryPreference: null,
      categoryDistribution: {},
    }
  }

  // Calculate expected distribution based on school-wide distribution
  const totalSchoolPoints = Object.values(schoolHouseDistribution).reduce((a, b) => a + b, 0)
  const expectedDistribution: Record<string, number> = {}
  houseNames.forEach((house) => {
    const schoolPct = totalSchoolPoints > 0 ? schoolHouseDistribution[house] / totalSchoolPoints : 0.25
    expectedDistribution[house] = totalStaffPoints * schoolPct
  })

  // Calculate chi-square
  const observed = houseNames.map((h) => staffHousePoints[h] || 0)
  const expected = houseNames.map((h) => expectedDistribution[h] || totalStaffPoints / houseNames.length)
  const chiSquare = calculateChiSquare(observed, expected)

  const degreesOfFreedom = houseNames.length - 1
  const biasCoefficient = chiSquareToBiasCoefficient(chiSquare, degreesOfFreedom)

  // Find favored house
  let favoredHouse: string | null = null
  let maxDiff = 0
  houseNames.forEach((house) => {
    const diff = staffHousePoints[house] - (expectedDistribution[house] || 0)
    if (diff > maxDiff) {
      maxDiff = diff
      favoredHouse = house
    }
  })

  // Determine if bias is significant (coefficient > 2)
  const hasBias = biasCoefficient > 2
  let biasDescription: string | null = null
  if (hasBias && favoredHouse) {
    const favoredPct = (staffHousePoints[favoredHouse] / totalStaffPoints) * 100
    biasDescription = `Staff gives ${favoredPct.toFixed(1)}% of points to ${favoredHouse} (expected ~${((expectedDistribution[favoredHouse] || 0) / totalStaffPoints * 100).toFixed(1)}%)`
  }

  // Analyze category preferences
  const categoryPoints: Record<string, number> = {
    Respect: 0,
    Responsibility: 0,
    Righteousness: 0,
    Other: 0,
  }
  staffEntries.forEach((entry) => {
    const category = getThreeRCategory(String(entry.r ?? ''))
    categoryPoints[category] += Number(entry.points ?? 0) || 0
  })

  // Find favorite category
  let categoryPreference: string | null = null
  let maxCategoryPoints = 0
  Object.entries(categoryPoints).forEach(([cat, points]) => {
    if (cat !== 'Other' && points > maxCategoryPoints) {
      maxCategoryPoints = points
      categoryPreference = cat
    }
  })

  return {
    staffEmail: '',
    staffName,
    houseBiasCoefficient: Math.round(biasCoefficient * 100) / 100,
    houseDistribution: staffHousePoints,
    favoredHouse,
    hasBias,
    biasDescription,
    categoryPreference,
    categoryDistribution: categoryPoints,
  }
}

/**
 * Detect outlier staff (giving significantly more/fewer points than average)
 */
export function detectOutlierStaff(
  staffPointsMap: Map<string, number>,
  threshold: number = 2.0 // Z-score threshold
): OutlierAnalysis[] {
  const pointsArray = Array.from(staffPointsMap.values())
  if (pointsArray.length === 0) return []

  const mean = pointsArray.reduce((a, b) => a + b, 0) / pointsArray.length
  const stdDev = calculateStandardDeviation(pointsArray)

  const outliers: OutlierAnalysis[] = []

  staffPointsMap.forEach((points, staffName) => {
    const zScore = calculateZScore(points, mean, stdDev)
    const isOutlier = Math.abs(zScore) >= threshold
    const outlierType = isOutlier ? (zScore > 0 ? 'high' : 'low') : null

    let outlierReason: string | null = null
    if (isOutlier) {
      if (outlierType === 'high') {
        outlierReason = `Giving ${((points / mean) * 100 - 100).toFixed(0)}% more points than average (${points} vs ${mean.toFixed(1)})`
      } else {
        outlierReason = `Giving ${((1 - points / mean) * 100).toFixed(0)}% fewer points than average (${points} vs ${mean.toFixed(1)})`
      }
    }

    outliers.push({
      staffEmail: '',
      staffName,
      pointsGiven: points,
      schoolAverage: mean,
      zScore: Math.round(zScore * 100) / 100,
      isOutlier,
      outlierType,
      outlierReason,
    })
  })

  return outliers
}

/**
 * Generate comprehensive staff analytics
 */
export async function generateStaffAnalytics(
  startDate: string,
  endDate: string,
  schoolId: string,
  analysisPeriod: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<StaffAnalyticsRecord[]> {
  const supabase = getSupabaseAdmin()
  const houseNames = await loadSchoolHouseNames(schoolId)

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

  // Build staff email lookup
  const staffEmailMap = new Map<string, string>()
  staffRows.forEach((row) => {
    const name = String(row.staff_name ?? '').trim().toLowerCase()
    const email = String(row.email ?? '').trim()
    if (name && email) staffEmailMap.set(name, email)
  })

  // Calculate school-wide house distribution for bias analysis
  const schoolHouseDistribution: Record<string, number> = {}
  houseNames.forEach((house) => {
    schoolHouseDistribution[house] = 0
  })
  entries.forEach((entry) => {
    const house = canonicalHouseName(String(entry.house ?? '').trim())
    if (house && schoolHouseDistribution[house] !== undefined) {
      schoolHouseDistribution[house] += Number(entry.points ?? 0) || 0
    }
  })

  // Group entries by staff
  const entriesByStaff = new Map<string, MeritRow[]>()
  const pointsByStaff = new Map<string, number>()
  const activeDaysByStaff = new Map<string, Set<string>>()

  entries.forEach((entry) => {
    const staffName = String(entry.staff_name ?? '').trim()
    if (!staffName) return

    const key = staffName.toLowerCase()
    if (!entriesByStaff.has(key)) {
      entriesByStaff.set(key, [])
      pointsByStaff.set(key, 0)
      activeDaysByStaff.set(key, new Set())
    }

    entriesByStaff.get(key)!.push(entry)
    pointsByStaff.set(key, (pointsByStaff.get(key) || 0) + (Number(entry.points ?? 0) || 0))

    const date = getEntryDate(entry)
    if (date) {
      activeDaysByStaff.get(key)!.add(date)
    }
  })

  // Detect outliers
  const outlierAnalysis = detectOutlierStaff(pointsByStaff)
  const outlierMap = new Map<string, OutlierAnalysis>()
  outlierAnalysis.forEach((oa) => {
    outlierMap.set(oa.staffName.toLowerCase(), oa)
  })

  // Calculate school average
  const totalPoints = Array.from(pointsByStaff.values()).reduce((a, b) => a + b, 0)
  const activeStaffCount = pointsByStaff.size
  const schoolAvgPoints = activeStaffCount > 0 ? totalPoints / activeStaffCount : 0

  // Generate analytics for each staff member
  const results: StaffAnalyticsRecord[] = []

  entriesByStaff.forEach((staffEntries, staffKey) => {
    const biasAnalysis = analyzeStaffHouseBias(staffEntries, schoolHouseDistribution, houseNames)
    const outlier = outlierMap.get(staffKey)
    const staffName = staffEntries[0]?.staff_name || staffKey
    const email = staffEmailMap.get(staffKey) || `${staffKey}@unknown.com`

    results.push({
      school_id: schoolId,
      staff_email: email,
      staff_name: staffName,
      analysis_date: endDate,
      analysis_period: analysisPeriod,
      points_given_period: pointsByStaff.get(staffKey) || 0,
      active_days_period: activeDaysByStaff.get(staffKey)?.size || 0,
      favorite_category: biasAnalysis.categoryPreference,
      category_distribution: biasAnalysis.categoryDistribution,
      house_bias_coefficient: biasAnalysis.houseBiasCoefficient,
      house_distribution: biasAnalysis.houseDistribution,
      favored_house: biasAnalysis.favoredHouse,
      outlier_flag: outlier?.isOutlier || false,
      outlier_reason: outlier?.outlierReason || null,
      z_score: outlier?.zScore || null,
      school_avg_points: schoolAvgPoints,
    })
  })

  return results
}

/**
 * Save staff analytics to database
 */
export async function saveStaffAnalytics(records: StaffAnalyticsRecord[]): Promise<void> {
  if (records.length === 0) return

  const supabase = getSupabaseAdmin()

  const { error } = await supabase.from(Tables.staffAnalytics).upsert(
    records.map((r) => ({
      ...r,
      category_distribution: r.category_distribution,
      house_distribution: r.house_distribution,
    })),
    { onConflict: 'school_id,staff_email,analysis_date,analysis_period' }
  )

  if (error) throw error
}

/**
 * Get staff with potential bias issues
 */
export async function getStaffWithBias(
  schoolId: string,
  biasThreshold: number = 4.0
): Promise<StaffAnalyticsRecord[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.staffAnalytics)
    .select('*')
    .eq('school_id', schoolId)
    .gte('house_bias_coefficient', biasThreshold)
    .order('analysis_date', { ascending: false })

  if (error) throw error
  return (data || []) as StaffAnalyticsRecord[]
}

/**
 * Get staff outliers
 */
export async function getStaffOutliers(schoolId: string): Promise<StaffAnalyticsRecord[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from(Tables.staffAnalytics)
    .select('*')
    .eq('school_id', schoolId)
    .eq('outlier_flag', true)
    .order('analysis_date', { ascending: false })

  if (error) throw error
  return (data || []) as StaffAnalyticsRecord[]
}
