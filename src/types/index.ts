// ─── Auth & Users ────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  // GDPR consent tracking
  gdpr_consent_at: string | null
  terms_accepted_at: string | null
  marketing_consent: boolean
  created_at: string
  updated_at: string
}

// ─── Organizations ────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'starter' | 'pro' | 'business'
export type ScheduleType = 'shifts' | 'school'

export interface Organization {
  id: string
  name: string
  country_code: string        // ISO 3166-1 alpha-2, e.g. 'RO', 'DE'
  plan: PlanType
  // Stripe
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  // Limits
  max_employees: number
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  invited_by: string | null
  accepted_at: string | null
  created_at: string
}

// ─── Employees ───────────────────────────────────────────────────────────────

export type ExperienceLevel = 'junior' | 'mid' | 'senior'

export interface Employee {
  id: string
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  experience_level: ExperienceLevel
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmployeeLeave {
  id: string
  employee_id: string
  start_date: string    // ISO date
  end_date: string      // ISO date
  reason: string | null
  created_at: string
}

export interface EmployeeUnavailability {
  id: string
  employee_id: string
  day_of_week: number | null    // 0=Sun, 1=Mon ... 6=Sat
  specific_date: string | null
  note: string | null
  created_at: string
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom'

export interface ShiftDefinition {
  id: string
  organization_id: string
  name: string
  shift_type: ShiftType
  start_time: string      // HH:MM
  end_time: string        // HH:MM
  crosses_midnight: boolean
  color: string
  created_at: string
}

// ─── Schedules ───────────────────────────────────────────────────────────────

export type GenerationStatus = 'draft' | 'generating' | 'generated' | 'published'

export interface Schedule {
  id: string
  organization_id: string
  name: string
  type: ScheduleType
  start_date: string      // ISO date
  end_date: string        // ISO date
  working_days: number[]  // [1,2,3,4,5] = Mon-Fri (1=Mon, 7=Sun)
  include_holidays: boolean
  country_code: string
  status: GenerationStatus
  generation_config: GenerationConfig
  ai_suggestions: AISuggestion[] | null
  ai_analyzed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface GenerationConfig {
  min_employees_per_shift: number
  max_consecutive_days: number
  min_rest_hours_between_shifts: number
  max_weekly_hours: number
  max_night_shifts_per_week: number
  enforce_legal_limits: boolean
  balance_shift_distribution: boolean
  min_window_periods?: number
}

export interface AISuggestion {
  type: 'warning' | 'info' | 'improvement'
  title: string
  message: string
  affectedEmployees?: string[]
  dates?: string[]
}

// ─── Schedule Shifts ─────────────────────────────────────────────────────────

export interface ScheduleShift {
  id: string
  schedule_id: string
  shift_definition_id: string
  slots_per_day: number
}

// ─── Shift Assignments ───────────────────────────────────────────────────────

export interface ShiftAssignment {
  id: string
  schedule_id: string
  employee_id: string
  shift_definition_id: string
  date: string                  // ISO date
  role_in_shift: string | null
  is_manual_override: boolean
  note: string | null
  created_at: string
}

// ─── Constraints ─────────────────────────────────────────────────────────────

export type ConstraintType =
  | 'pair_required'
  | 'pair_forbidden'
  | 'rest_after_shift'
  | 'max_consecutive'
  | 'max_weekly_hours'
  | 'max_night_shifts'
  | 'min_seniority'
  | 'min_staff'
  | 'fixed_shift'

export interface Constraint {
  id: string
  schedule_id: string
  type: ConstraintType
  employee_id: string | null
  target_employee_id: string | null
  shift_definition_id: string | null
  value: number | null
  note: string | null
  is_active: boolean
  created_at: string
}

// ─── School: Subjects ────────────────────────────────────────────────────────

export interface Subject {
  id: string
  organization_id: string
  name: string
  color: string
  created_at: string
}

export interface TeacherSubject {
  id: string
  employee_id: string
  subject_id: string
  hours_per_week: number
}

// ─── Public Holidays (from date.nager.at) ────────────────────────────────────

export interface PublicHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
}
