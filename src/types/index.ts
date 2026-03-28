// ─────────────────────────────────────────────────────────────────────────────
// src/types/index.ts — single source of truth for all TypeScript types.
// Mirrors Supabase DB schema. Update when migrations change.
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole         = 'owner' | 'admin' | 'editor' | 'viewer'
export type PlanType         = 'free' | 'starter' | 'pro' | 'business'
export type OrgType          = 'business' | 'education'
export type ScheduleType     = 'shifts' | 'school'
export type GenerationStatus = 'draft' | 'generating' | 'generated' | 'published'
export type ShiftType        = 'morning' | 'afternoon' | 'night' | 'custom'
export type ExperienceLevel  = 'junior' | 'mid' | 'senior'
export type ConstraintType   =
  | 'pair_required' | 'pair_forbidden'
  | 'rest_after_shift' | 'max_consecutive'
  | 'max_weekly_hours' | 'max_night_shifts'
  | 'min_seniority' | 'min_staff' | 'fixed_shift'
export type RoomType         = 'classroom' | 'lab' | 'gym' | 'amphitheater' | 'seminar' | 'workshop'
export type SubjectDifficulty = 'hard' | 'medium' | 'easy'
export type LessonType       = 'regular' | 'lecture' | 'seminar' | 'lab'

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  active_organization_id: string | null
  gdpr_consent_at: string | null
  terms_accepted_at: string | null
  marketing_consent: boolean
  created_at: string
  updated_at: string
}

// ── Organizations ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  country_code: string
  plan: PlanType
  org_type: OrgType
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
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

// Used throughout dashboard — loaded once in layout
export interface OrgContextData {
  profile: Profile
  org: Organization
  allOrgs: Organization[]
  role: UserRole
}

// ── Employees ─────────────────────────────────────────────────────────────────

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
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
}

export interface EmployeeUnavailability {
  id: string
  employee_id: string
  day_of_week: number | null
  specific_date: string | null
  note: string | null
  created_at: string
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export interface ShiftDefinition {
  id: string
  organization_id: string
  name: string
  shift_type: ShiftType
  start_time: string
  end_time: string
  crosses_midnight: boolean
  color: string
  created_at: string
}

export interface ScheduleShift {
  id: string
  schedule_id: string
  shift_definition_id: string
  slots_per_day: number
}

export interface ShiftAssignment {
  id: string
  schedule_id: string
  employee_id: string
  shift_definition_id: string
  date: string
  role_in_shift: string | null
  is_manual_override: boolean
  note: string | null
  created_at: string
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export interface GenerationConfig {
  min_employees_per_shift: number
  max_consecutive_days: number
  min_rest_hours_between_shifts: number
  max_weekly_hours: number
  max_night_shifts_per_week: number
  enforce_legal_limits: boolean
  balance_shift_distribution: boolean
  shift_consistency: number
}

export interface AISuggestion {
  type: 'warning' | 'info' | 'improvement'
  title: string
  message: string
  affectedEmployees?: string[]
  dates?: string[]
}

export interface Schedule {
  id: string
  organization_id: string
  name: string
  type: ScheduleType
  start_date: string
  end_date: string
  working_days: number[]
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

// ── School ────────────────────────────────────────────────────────────────────

export interface SchoolTeacher {
  id: string
  organization_id: string
  name: string
  email: string | null
  max_periods_per_day: number
  max_periods_per_week: number
  color: string
  created_at: string
}

export interface SchoolSubject {
  id: string
  organization_id: string
  name: string
  short_name: string
  color: string
  difficulty: SubjectDifficulty
  required_room_type: RoomType
  created_at: string
}

export interface SchoolClass {
  id: string
  organization_id: string
  name: string
  year: number
  student_count: number
  has_groups: boolean
  created_at: string
}

export interface SchoolGroup {
  id: string
  class_id: string
  name: string
  student_count: number
  created_at: string
}

export interface SchoolRoom {
  id: string
  organization_id: string
  name: string
  room_type: RoomType
  capacity: number
  building: string | null
  created_at: string
}

export interface SchoolConfig {
  id: string
  schedule_id: string
  institution_type: 'primary' | 'middle' | 'highschool' | 'university'
  periods_per_day: number
  period_duration_min: number
  first_period_start: string
  max_periods_per_day: number
  min_periods_per_day: number
  avoid_teacher_windows: boolean
  hard_subjects_morning: boolean
  created_at: string
}

export interface SchoolAssignment {
  id: string
  schedule_id: string
  teacher_id: string
  subject_id: string
  class_id: string
  group_id: string | null
  lesson_type: LessonType
  periods_per_week: number
  requires_consecutive: boolean
  preferred_room_id: string | null
  created_at: string
}

export interface SchoolLesson {
  id: string
  schedule_id: string
  assignment_id: string
  teacher_id: string
  subject_id: string
  class_id: string
  group_id: string | null
  room_id: string | null
  day: number
  period: number
  is_manual_override: boolean
  created_at: string
}

export interface SchoolResources {
  teachers: SchoolTeacher[]
  subjects: SchoolSubject[]
  classes: SchoolClass[]
  rooms: SchoolRoom[]
}

// ── Holidays ──────────────────────────────────────────────────────────────────

export interface PublicHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
}