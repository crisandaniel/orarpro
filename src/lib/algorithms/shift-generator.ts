import { addDays, format, differenceInHours, parseISO, getDay } from 'date-fns'
import type { Database } from '@/types/database'

type Employee = Database['public']['Tables']['employees']['Row']
type ShiftDefinition = Database['public']['Tables']['shift_definitions']['Row']
type Constraint = Database['public']['Tables']['constraints']['Row']
type Leave = Database['public']['Tables']['employee_leaves']['Row']
type Unavailability = Database['public']['Tables']['employee_unavailability']['Row']

export interface GenerationInput {
  scheduleId: string
  startDate: string
  endDate: string
  workingDays: number[]          // ISO weekday 1=Mon..7=Sun
  holidayDates: string[]         // ISO dates to skip if include_holidays=true
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  slotsPerDay: Record<string, number>  // shiftDefinitionId -> slots per day
  constraints: Constraint[]
  leaves: Leave[]
  unavailability: Unavailability[]
  config: GenerationConfig
}

export interface GenerationConfig {
  min_employees_per_shift: number
  max_consecutive_days: number
  min_rest_hours_between_shifts: number
  max_weekly_hours: number
  max_night_shifts_per_week: number
  enforce_legal_limits: boolean
  balance_shift_distribution: boolean
}

export interface AssignmentResult {
  employee_id: string
  shift_definition_id: string
  date: string
  role_in_shift: string | null
  is_manual_override: boolean
}

export interface GenerationResult {
  assignments: AssignmentResult[]
  violations: Violation[]
  stats: GenerationStats
}

export interface Violation {
  type: string
  message: string
  employee_id?: string
  date?: string
  severity: 'error' | 'warning'
}

export interface GenerationStats {
  totalAssignments: number
  totalDays: number
  avgShiftsPerEmployee: number
  unfilledSlots: number
  violationCount: number
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export class ScheduleGenerator {
  private input: GenerationInput
  private assignments: AssignmentResult[] = []
  private violations: Violation[] = []

  // Track per-employee state for constraint checking
  private employeeShiftCount: Map<string, number> = new Map()
  private employeeWeeklyHours: Map<string, Map<string, number>> = new Map() // employeeId -> weekKey -> hours
  private employeeNightShifts: Map<string, Map<string, number>> = new Map() // employeeId -> weekKey -> count
  private employeeLastShiftEnd: Map<string, Date | null> = new Map()
  private employeeConsecutiveDays: Map<string, number> = new Map()
  private employeeLastWorkDate: Map<string, string | null> = new Map()

  constructor(input: GenerationInput) {
    this.input = input
    input.employees.forEach(e => {
      this.employeeShiftCount.set(e.id, 0)
      this.employeeWeeklyHours.set(e.id, new Map())
      this.employeeNightShifts.set(e.id, new Map())
      this.employeeLastShiftEnd.set(e.id, null)
      this.employeeConsecutiveDays.set(e.id, 0)
      this.employeeLastWorkDate.set(e.id, null)
    })
  }

  generate(): GenerationResult {
    const dates = this.getWorkingDates()

    for (const date of dates) {
      for (const shift of this.input.shiftDefinitions) {
        const slots = this.input.slotsPerDay[shift.id] ?? 1
        this.fillShiftSlots(date, shift, slots)
      }
    }

    this.validateFinalSchedule()

    return {
      assignments: this.assignments,
      violations: this.violations,
      stats: this.buildStats(dates.length),
    }
  }

  // ─── Date helpers ───────────────────────────────────────────────────────────

  private getWorkingDates(): string[] {
    const dates: string[] = []
    const start = parseISO(this.input.startDate)
    const end = parseISO(this.input.endDate)
    let current = start

    while (current <= end) {
      const isoDate = format(current, 'yyyy-MM-dd')
      const dayOfWeek = getDay(current) // 0=Sun..6=Sat
      // Convert to ISO weekday (1=Mon..7=Sun)
      const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek

      const isWorkingDay = this.input.workingDays.includes(isoWeekday)
      const isHoliday = this.input.holidayDates.includes(isoDate)

      if (isWorkingDay && !isHoliday) {
        dates.push(isoDate)
      }
      current = addDays(current, 1)
    }

    return dates
  }

  // ─── Fill slots for one shift on one date ───────────────────────────────────

  private fillShiftSlots(date: string, shift: ShiftDefinition, slots: number): void {
    const eligible = this.getEligibleEmployees(date, shift)

    // Sort by least shifts assigned (balance distribution)
    if (this.input.config.balance_shift_distribution) {
      eligible.sort((a, b) =>
        (this.employeeShiftCount.get(a.id) ?? 0) - (this.employeeShiftCount.get(b.id) ?? 0)
      )
    }

    // Apply pair_required constraints — group required pairs together
    const orderedEmployees = this.applyPairingOrder(eligible, shift)

    let filled = 0
    for (const employee of orderedEmployees) {
      if (filled >= slots) break
      if (this.canAssign(employee, shift, date)) {
        this.assign(employee, shift, date)
        filled++
      }
    }

    // Record unfilled slots as warnings
    if (filled < this.input.config.min_employees_per_shift) {
      this.violations.push({
        type: 'unfilled_slot',
        message: `Shift "${shift.name}" on ${date} has only ${filled}/${this.input.config.min_employees_per_shift} employees`,
        date,
        severity: 'warning',
      })
    }
  }

  // ─── Get employees eligible to work this shift/date ────────────────────────

  private getEligibleEmployees(date: string, shift: ShiftDefinition): Employee[] {
    return this.input.employees.filter(e => {
      if (!e.is_active) return false
      if (this.isOnLeave(e.id, date)) return false
      if (this.isUnavailable(e.id, date)) return false
      if (this.alreadyAssigned(e.id, date, shift.id)) return false
      return true
    })
  }

  // ─── Core constraint checker ────────────────────────────────────────────────

  private canAssign(employee: Employee, shift: ShiftDefinition, date: string): boolean {
    const config = this.input.config

    // Check pair_forbidden constraints
    if (this.violatesForbiddenPair(employee.id, shift.id, date)) return false

    // Check rest between shifts
    const lastEnd = this.employeeLastShiftEnd.get(employee.id)
    if (lastEnd) {
      const shiftStart = this.getShiftStartDateTime(date, shift.start_time)
      const restHours = differenceInHours(shiftStart, lastEnd)
      const minRest = this.getRestConstraint(employee.id, shift.id) ??
        config.min_rest_hours_between_shifts
      if (restHours < minRest) return false
    }

    // Check max consecutive days
    const consecutive = this.employeeConsecutiveDays.get(employee.id) ?? 0
    const maxConsecutive = this.getMaxConsecutiveConstraint(employee.id) ??
      config.max_consecutive_days
    if (consecutive >= maxConsecutive) return false

    // Check weekly hours
    const weekKey = this.getWeekKey(date)
    const weeklyHours = this.employeeWeeklyHours.get(employee.id)?.get(weekKey) ?? 0
    const shiftHours = this.getShiftHours(shift)
    const maxWeekly = this.getMaxWeeklyHoursConstraint(employee.id) ??
      config.max_weekly_hours
    if (weeklyHours + shiftHours > maxWeekly) return false

    // Check max night shifts per week
    if (shift.shift_type === 'night') {
      const nightCount = this.employeeNightShifts.get(employee.id)?.get(weekKey) ?? 0
      const maxNights = config.max_night_shifts_per_week
      if (nightCount >= maxNights) return false
    }

    // Check min_seniority: if shift requires senior, skip juniors
    if (this.shiftRequiresSenior(shift.id)) {
      const seniorPresent = this.assignments.some(
        a => a.shift_definition_id === shift.id && a.date === date &&
          this.input.employees.find(e => e.id === a.employee_id)?.experience_level === 'senior'
      )
      if (!seniorPresent && employee.experience_level === 'junior') return false
    }

    return true
  }

  // ─── Record assignment and update state ────────────────────────────────────

  private assign(employee: Employee, shift: ShiftDefinition, date: string): void {
    this.assignments.push({
      employee_id: employee.id,
      shift_definition_id: shift.id,
      date,
      role_in_shift: null,
      is_manual_override: false,
    })

    // Update counters
    this.employeeShiftCount.set(employee.id, (this.employeeShiftCount.get(employee.id) ?? 0) + 1)

    const weekKey = this.getWeekKey(date)
    const hours = this.getShiftHours(shift)
    const weekMap = this.employeeWeeklyHours.get(employee.id) ?? new Map()
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + hours)
    this.employeeWeeklyHours.set(employee.id, weekMap)

    if (shift.shift_type === 'night') {
      const nightMap = this.employeeNightShifts.get(employee.id) ?? new Map()
      nightMap.set(weekKey, (nightMap.get(weekKey) ?? 0) + 1)
      this.employeeNightShifts.set(employee.id, nightMap)
    }

    // Update last shift end time
    const shiftEnd = this.getShiftEndDateTime(date, shift.end_time, shift.crosses_midnight)
    this.employeeLastShiftEnd.set(employee.id, shiftEnd)

    // Update consecutive days
    const lastWork = this.employeeLastWorkDate.get(employee.id)
    const yesterday = format(addDays(parseISO(date), -1), 'yyyy-MM-dd')
    if (lastWork === yesterday) {
      this.employeeConsecutiveDays.set(employee.id, (this.employeeConsecutiveDays.get(employee.id) ?? 0) + 1)
    } else {
      this.employeeConsecutiveDays.set(employee.id, 1)
    }
    this.employeeLastWorkDate.set(employee.id, date)
  }

  // ─── Constraint lookups ─────────────────────────────────────────────────────

  private getRestConstraint(employeeId: string, shiftId: string): number | null {
    const c = this.input.constraints.find(
      c => c.type === 'rest_after_shift' && c.is_active &&
        (c.employee_id === null || c.employee_id === employeeId) &&
        (c.shift_definition_id === null || c.shift_definition_id === shiftId)
    )
    return c?.value ?? null
  }

  private getMaxConsecutiveConstraint(employeeId: string): number | null {
    const c = this.input.constraints.find(
      c => c.type === 'max_consecutive' && c.is_active &&
        (c.employee_id === null || c.employee_id === employeeId)
    )
    return c?.value ?? null
  }

  private getMaxWeeklyHoursConstraint(employeeId: string): number | null {
    const c = this.input.constraints.find(
      c => c.type === 'max_weekly_hours' && c.is_active &&
        (c.employee_id === null || c.employee_id === employeeId)
    )
    return c?.value ?? null
  }

  private shiftRequiresSenior(shiftId: string): boolean {
    return this.input.constraints.some(
      c => c.type === 'min_seniority' && c.is_active &&
        (c.shift_definition_id === null || c.shift_definition_id === shiftId)
    )
  }

  private violatesForbiddenPair(employeeId: string, shiftId: string, date: string): boolean {
    const forbiddenPairs = this.input.constraints.filter(
      c => c.type === 'pair_forbidden' && c.is_active &&
        (c.employee_id === employeeId || c.target_employee_id === employeeId)
    )

    return forbiddenPairs.some(constraint => {
      const otherId = constraint.employee_id === employeeId
        ? constraint.target_employee_id
        : constraint.employee_id

      return this.assignments.some(
        a => a.employee_id === otherId &&
          a.shift_definition_id === shiftId &&
          a.date === date
      )
    })
  }

  private applyPairingOrder(employees: Employee[], shift: ShiftDefinition): Employee[] {
    // Move pair_required employees together in sort order
    const required = this.input.constraints.filter(
      c => c.type === 'pair_required' && c.is_active
    )
    if (required.length === 0) return employees

    // Simple: bring required-pair members to front
    const priorityIds = new Set(required.flatMap(c =>
      [c.employee_id, c.target_employee_id].filter(Boolean) as string[]
    ))
    return [
      ...employees.filter(e => priorityIds.has(e.id)),
      ...employees.filter(e => !priorityIds.has(e.id)),
    ]
  }

  // ─── Availability helpers ───────────────────────────────────────────────────

  private isOnLeave(employeeId: string, date: string): boolean {
    return this.input.leaves.some(
      l => l.employee_id === employeeId &&
        l.start_date <= date && l.end_date >= date
    )
  }

  private isUnavailable(employeeId: string, date: string): boolean {
    const dayOfWeek = getDay(parseISO(date)) // 0=Sun
    return this.input.unavailability.some(u => {
      if (u.employee_id !== employeeId) return false
      if (u.specific_date) return u.specific_date === date
      if (u.day_of_week !== null) return u.day_of_week === dayOfWeek
      return false
    })
  }

  private alreadyAssigned(employeeId: string, date: string, shiftId: string): boolean {
    return this.assignments.some(
      a => a.employee_id === employeeId && a.date === date && a.shift_definition_id === shiftId
    )
  }

  // ─── Time helpers ───────────────────────────────────────────────────────────

  private getShiftStartDateTime(date: string, startTime: string): Date {
    return new Date(`${date}T${startTime}:00`)
  }

  private getShiftEndDateTime(date: string, endTime: string, crossesMidnight: boolean): Date {
    const end = new Date(`${date}T${endTime}:00`)
    if (crossesMidnight) end.setDate(end.getDate() + 1)
    return end
  }

  private getShiftHours(shift: ShiftDefinition): number {
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    let startMinutes = sh * 60 + sm
    let endMinutes = eh * 60 + em
    if (shift.crosses_midnight) endMinutes += 24 * 60
    return (endMinutes - startMinutes) / 60
  }

  private getWeekKey(date: string): string {
    const d = parseISO(date)
    const year = d.getFullYear()
    const week = Math.ceil(
      ((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7
    )
    return `${year}-W${week}`
  }

  // ─── Final validation pass ──────────────────────────────────────────────────

  private validateFinalSchedule(): void {
    // Check pair_required constraints were satisfied
    const dates = this.getWorkingDates()
    const required = this.input.constraints.filter(
      c => c.type === 'pair_required' && c.is_active
    )

    for (const constraint of required) {
      if (!constraint.employee_id || !constraint.target_employee_id) continue

      for (const shift of this.input.shiftDefinitions) {
        for (const date of dates) {
          const aWorking = this.assignments.some(
            a => a.employee_id === constraint.employee_id &&
              a.shift_definition_id === shift.id && a.date === date
          )
          const bWorking = this.assignments.some(
            a => a.employee_id === constraint.target_employee_id &&
              a.shift_definition_id === shift.id && a.date === date
          )

          if (aWorking !== bWorking) {
            const empA = this.input.employees.find(e => e.id === constraint.employee_id)
            const empB = this.input.employees.find(e => e.id === constraint.target_employee_id)
            this.violations.push({
              type: 'pair_required_violated',
              message: `${empA?.name} and ${empB?.name} should work together but are on different shifts on ${date}`,
              date,
              severity: 'warning',
            })
          }
        }
      }
    }
  }

  private buildStats(totalDays: number): GenerationStats {
    const unfilledSlots = this.violations.filter(v => v.type === 'unfilled_slot').length
    const totalAssignments = this.assignments.length
    const avgShifts = this.input.employees.length > 0
      ? totalAssignments / this.input.employees.length
      : 0

    return {
      totalAssignments,
      totalDays,
      avgShiftsPerEmployee: Math.round(avgShifts * 10) / 10,
      unfilledSlots,
      violationCount: this.violations.length,
    }
  }
}
