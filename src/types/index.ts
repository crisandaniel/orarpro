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
export type RoomType         = 'homeroom' | 'gym' | 'computer_lab' | 'chemistry_lab' | 'generic'
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

// ── School types (v3) ────────────────────────────────────────────────────────

export type ClassStage = 'primary' | 'middle' | 'high' | 'university'

export interface SchoolTeacher {
  id: string
  organization_id: string
  name: string
  color: string
  // Sloturi în care NU poate preda — format "day-period" ex: "0-3" = Luni ora 4
  unavailable_slots: string[]
  // Sloturi preferate (soft constraint)
  preferred_slots: string[]
  // Limite ore (null = fără limită)
  max_lessons_per_day:  number | null
  max_lessons_per_week: number | null
  min_lessons_per_week: number | null  // normă minimă — hard când setat
  created_at: string
}

export interface SchoolSubject {
  id: string
  organization_id: string
  name: string
  short_name: string | null
  color: string
  required_room_type: RoomType | null   // null = orice sală
  difficulty: SubjectDifficulty
  created_at: string
}

export interface SchoolClass {
  id: string
  organization_id: string
  name: string
  grade_number: number
  stage: ClassStage
  max_lessons_per_day: number
  homeroom_id: string | null
  created_at: string
}

export interface SchoolRoom {
  id: string
  organization_id: string
  name: string
  type: RoomType
  capacity: number | null
  created_at: string
}

export interface SchoolResources {
  teachers: SchoolTeacher[]
  subjects: SchoolSubject[]
  classes: SchoolClass[]
  rooms: SchoolRoom[]
}

// SoftRules — stocate ca jsonb în schedule_configs
export interface SoftRules {
  avoidGapsForTeachers?:       boolean
  avoidLastHourForStages?:     ClassStage[]
  avoidSameSubjectTwicePerDay?: boolean
  hardSubjectsMorning?:        boolean
  startFromFirstSlot?:         boolean
  weights: {
    teacherGaps:  number  // 0-100
    lastHour:     number  // 0-100
    sameSubject:  number  // 0-100
    hardMorning:  number  // 0-100
    startFirst:   number  // 0-100
  }
}

export interface ScheduleConfig {
  id: string
  schedule_id: string
  days_per_week:    number
  slots_per_day:    number
  slot_duration:    number
  first_slot_start: string
  soft_rules:       SoftRules
  solver_used:      string | null
  generated_at:     string | null
  created_at:       string
}

export interface CurriculumItem {
  id: string
  schedule_id: string
  class_id: string
  subject_id: string
  teacher_id: string
  weekly_hours: number
  lesson_pattern: number[] | null  // null = implicit [1,1,...,1]
  preferred_room_id: string | null
  created_at: string
}

export interface SchoolLesson {
  id: string
  schedule_id: string
  class_id: string
  subject_id: string
  teacher_id: string
  room_id: string | null
  day: number      // 0-based (0=Luni)
  period: number   // 0-based
  duration: number // 1 sau 2
  is_manual: boolean
  created_at: string
}

// FeasibilityCheck — calculat client-side înainte de generare
export interface FeasibilityError {
  type: 'teacher_overloaded' | 'class_overloaded' | 'no_valid_slot' | 'no_room' | 'pattern_invalid'
  entity: string   // numele resursei cu problema
  detail: string   // mesaj human-readable
}

export interface FeasibilityCheck {
  ok: boolean
  errors: FeasibilityError[]
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