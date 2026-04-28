// ==========================================================================
// Namaa Systems Wizard — Core TypeScript Types
// ==========================================================================

// ---------------------------------------------------------------------------
// Step 1: School Profile
// ---------------------------------------------------------------------------
export interface SchoolProfileData {
  schoolName: string
  locDisplayName: string
  logoUrl: string
  timezone: string
  gradeBandMin: number
  gradeBandMax: number
  studentCountApprox: number
  tier: 'foundation' | 'strategic'
  onboardingDate: string   // ISO date
  contractStart: string    // ISO date
  contractEnd: string      // ISO date
}

// ---------------------------------------------------------------------------
// Step 2: Auth Configuration
// ---------------------------------------------------------------------------
export interface AuthConfigData {
  staffAuthEnabled: true  // always true
  studentsAuthEnabled: boolean
  studentAuthMode: 'all' | 'grade_minimum'
  studentMinGrade: number | null
  parentsAuthEnabled: boolean
  parentAuthMode: 'per_student' | 'per_family' | null
}

// ---------------------------------------------------------------------------
// Step 3: Academic Calendar
// ---------------------------------------------------------------------------
export interface TermData {
  termLabel: string   // e.g. "Term 1"
  startDate: string   // ISO date
  endDate: string     // ISO date
  resetDate: string   // ISO date
  termOrder: number
}

export interface CalendarData {
  yearLabel: string   // e.g. "2025-26"
  terms: TermData[]
}

// ---------------------------------------------------------------------------
// Step 4: Houses
// ---------------------------------------------------------------------------
export interface HouseRow {
  houseName: string
  houseColour: string
  houseIcon: string
  houseOrder: number
}

// ---------------------------------------------------------------------------
// Step 5: Domains
// ---------------------------------------------------------------------------
export type DomainKey = 'prayer_space' | 'hallways' | 'classroom' | 'lunch_recess' | 'washrooms'

export interface DomainConfig {
  domainKey: DomainKey
  isActive: boolean
  customDisplayName: string
}

export type DomainsData = DomainConfig[]

export const DOMAIN_DEFAULTS: Record<DomainKey, string> = {
  prayer_space: 'Prayer Space',
  hallways: 'Hallways',
  classroom: 'Classroom',
  lunch_recess: 'Lunch & Recess',
  washrooms: 'Washrooms',
}

// ---------------------------------------------------------------------------
// Step 6: Points Taxonomy
// ---------------------------------------------------------------------------
export interface BehaviourEntry {
  behaviourKey: string
  displayName: string
  defaultPoints: number
  customPoints: number | null
  isActive: boolean
}

export type PointsTaxonomyData = BehaviourEntry[]

export const DEFAULT_BEHAVIOURS: Omit<BehaviourEntry, 'customPoints' | 'isActive'>[] = [
  { behaviourKey: 'on_time_salah', displayName: 'On-time for Salah', defaultPoints: 5 },
  { behaviourKey: 'quran_memorization', displayName: 'Quran Memorization', defaultPoints: 10 },
  { behaviourKey: 'helping_peer', displayName: 'Helping a Peer', defaultPoints: 3 },
  { behaviourKey: 'hallway_conduct', displayName: 'Excellent Hallway Conduct', defaultPoints: 2 },
  { behaviourKey: 'classroom_participation', displayName: 'Classroom Participation', defaultPoints: 3 },
  { behaviourKey: 'lunch_etiquette', displayName: 'Lunch Etiquette', defaultPoints: 2 },
  { behaviourKey: 'washroom_respect', displayName: 'Washroom Respect', defaultPoints: 2 },
  { behaviourKey: 'community_service', displayName: 'Community Service', defaultPoints: 8 },
  { behaviourKey: 'leadership', displayName: 'Leadership Displayed', defaultPoints: 5 },
  { behaviourKey: 'conflict_resolution', displayName: 'Positive Conflict Resolution', defaultPoints: 4 },
]

// ---------------------------------------------------------------------------
// Step 7: Staff
// ---------------------------------------------------------------------------
export interface StaffRow {
  fullName: string
  email: string
  role: 'admin' | 'dean' | 'teacher' | 'staff'
  permissionLevel: 'full' | 'standard' | 'view_only'
  assignedDomains: DomainKey[]
}

// ---------------------------------------------------------------------------
// Step 8: Students
// ---------------------------------------------------------------------------
export interface StudentRow {
  schoolStudentId: string
  fullName: string
  grade: number
  gender: 'male' | 'female' | 'not_specified'
  houseName: string
  enrolledDate: string  // ISO date or empty
}

// ---------------------------------------------------------------------------
// Step 9: Parents
// ---------------------------------------------------------------------------
export interface ParentRow {
  fullName: string
  email: string
  phone: string
  preferredContactMethod: 'email' | 'phone' | 'either'
  linkedStudentIds: string[]  // school_student_id values
}

// ---------------------------------------------------------------------------
// Step 10: Thresholds
// ---------------------------------------------------------------------------
export interface ThresholdsData {
  levelAToBTrigger: number
  levelAToBWindowDays: number
  levelBToCTrigger: number
  autoAlertDeanOnLevelB: boolean
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export type RowSeverity = 'valid' | 'warning' | 'error'

export interface RowValidationResult {
  rowIndex: number
  severity: RowSeverity
  messages: string[]
}

export interface ValidationResult {
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  results: RowValidationResult[]
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------
export type ProvisioningStepStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'skipped'
export type ProvisioningRunStatus = 'success' | 'partial' | 'failed'

export interface ProvisioningStepResult {
  entity: string
  status: ProvisioningStepStatus
  rowsAttempted: number
  rowsSucceeded: number
  rowsFailed: number
  errorDetail: unknown[]
  timestamp: string
  message?: string
}

export type ProvisioningEvent =
  | { type: 'step_start'; entity: string }
  | { type: 'step_complete'; result: ProvisioningStepResult }
  | { type: 'step_error'; entity: string; error: string }
  | { type: 'done'; schoolId: string | null; status: ProvisioningRunStatus; steps: ProvisioningStepResult[]; message: string }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Wizard State (stored in localStorage)
// ---------------------------------------------------------------------------
export type StepStatus = 'not_started' | 'complete' | 'error'

export interface WizardState {
  draftId: string
  currentStep: number
  stepStatuses: Record<number, StepStatus>
  schoolProfile: SchoolProfileData | null
  authConfig: AuthConfigData | null
  calendar: CalendarData | null
  houses: HouseRow[] | null
  domains: DomainsData | null
  pointsTaxonomy: PointsTaxonomyData | null
  staff: StaffRow[] | null
  students: StudentRow[] | null
  parents: ParentRow[] | null
  thresholds: ThresholdsData | null
  provisionedSchoolId: string | null
  validationResults: Partial<Record<string, ValidationResult>>
  warningsAcknowledged: Partial<Record<string, boolean>>
  lastSaved: string
}

// ---------------------------------------------------------------------------
// School summary (dashboard)
// ---------------------------------------------------------------------------
export interface SchoolSummary {
  id: string
  name: string
  locDisplayName: string | null
  tier: string | null
  onboardingDate: string | null
  studentCount: number
  staffCount: number
  lastProvisionedAt: string | null
  provisioningStatus: 'complete' | 'partial' | 'failed' | 'not_started'
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------
export interface ExportPayload {
  exportVersion: string
  exportedAt: string
  school: Record<string, unknown>
  authConfig: Record<string, unknown>
  academicYears: unknown[]
  houses: unknown[]
  domains: unknown[]
  behaviourConfig: unknown[]
  staff: unknown[]
  students: unknown[]
  parents: unknown[]
  parentStudentLinks: unknown[]
  interventionConfig: Record<string, unknown>
  provisioningLog: unknown[]
}
