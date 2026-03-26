// ─── Auth & Users ────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

// ─── Organizations ────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'starter' | 'pro' | 'business'
export type ScheduleType = 'shifts' | 'school'

export interface Organization {
  id: string
  name: string
  country_code: string // ISO 3166-1 alpha-2, e.g. 'RO', 'DE'
  plan: PlanType
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  created_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
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
}

export interface EmployeeLeave {
  id: string
  employee_id: string
  start_date: string // ISO date
  end_date: string   // ISO date
  reason: string | null
}

export interface EmployeeUnavailability {
  id: string
  employee_id: string
  day_of_week: number | null  // 0=Sun, 1=Mon … 6=Sat — null = specific date
  specific_date: string | null
  note: string | null
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom'

export interface ShiftDefinition {
  id: string
  organization_id: string
  name: string
  shift_type: ShiftType
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  color: string       // hex color for UI
  crosses_midnight: boolean
}

// ─── Schedules ───────────────────────────────────────────────────────────────

export type GenerationStatus = 'draft' | 'generating' | 'generated' | 'published'

export interface Schedule {
  id: string
  organization_id: string
  name: string
  type: ScheduleType
  start_date: string  // ISO date
  end_date: string    // ISO date
  working_days: number[]  // [1,2,3,4,5] = Mon–Fri
  include_holidays: boolean
  country_code: string
  status: GenerationStatus
  generation_config: GenerationConfig
  created_by: string
  created_at: string
}

export interface GenerationConfig {
  min_employees_per_shift: number
  max_consecutive_days: number
  min_rest_hours_between_shifts: number
  max_weekly_hours: number
  max_night_shifts_per_week: number
  enforce_legal_limits: boolean
  balance_shift_distribution: boolean
  // School-specific
  min_window_periods?: number  // max allowed free periods between classes
}

// ─── Schedule Assignments ─────────────────────────────────────────────────────

export interface ShiftAssignment {
  id: string
  schedule_id: string
  employee_id: string
  shift_definition_id: string
  date: string           // ISO date
  role_in_shift: string | null  // e.g. "floor manager", "cashier"
  is_manual_override: boolean
  created_at: string
}

// ─── Constraints ─────────────────────────────────────────────────────────────

export type ConstraintType =
  | 'pair_required'        // Employee A must work with Employee B
  | 'pair_forbidden'       // Employee A cannot work with Employee B
  | 'rest_after_shift'     // After shift X, rest Y hours
  | 'max_consecutive'      // Max N consecutive working days
  | 'max_weekly_hours'     // Max N hours per week
  | 'max_night_shifts'     // Max N night shifts per week/month
  | 'min_seniority'        // Shift must have at least 1 senior
  | 'min_staff'            // Shift must have at least N employees
  | 'unavailable_day'      // Employee not available on day
  | 'fixed_shift'          // Employee always on same shift type

export interface Constraint {
  id: string
  schedule_id: string
  type: ConstraintType
  employee_id: string | null        // null = applies to all
  target_employee_id: string | null // for pair constraints
  shift_definition_id: string | null
  value: number | null              // hours, count, etc.
  note: string | null
  is_active: boolean
}

// ─── Public Holidays ─────────────────────────────────────────────────────────

export interface PublicHoliday {
  date: string   // ISO date
  localName: string
  name: string   