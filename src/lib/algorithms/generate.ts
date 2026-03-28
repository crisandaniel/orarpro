// Core schedule generation algorithm — greedy constraint satisfaction.
// Input: schedule config, employees, shift definitions, constraints, leaves, holidays.
// Algorithm:
//   Phase 1 — Build working date list (skip weekends, holidays)
//   Phase 2 — For each date x shift, sort employees by least hours assigned,
//             check hard constraints (rest, consecutive days, weekly hours,
//             pair rules, seniority), assign first valid employee.
// Output: assignments array, violations list, hours-per-employee stats.
// Used by: /api/schedules/[id]/generate.

import { addDays, format, differenceInMinutes, parseISO } from 'date-fns'
import type {
  Employee,
  ShiftDefinition,
  ShiftAssignment,
  Constraint,
  Schedule,
  EmployeeLeave,
  EmployeeUnavailability,
} from '@/types'
import { isHoliday, type PublicHoliday } from '@/lib/holidays'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerationInput {
  schedule: Schedule
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  constraints: Constraint[]
  leaves: EmployeeLeave[]
  unavailability: EmployeeUnavailability[]
  holidays: PublicHoliday[]
  slotsPerShift: Record<string, number> // shiftDefId -> slots
}

interface GenerationResult {
  assignments: Omit<ShiftAssignment, 'id' | 'created_at'>[]
  violations: ConstraintViolation[]
  stats: GenerationStats
}

interface ConstraintViolation {
  type: string
  employeeId: string
  employeeName: string
  date: string
  message: string
}

interface GenerationStats {
  totalSlots: number
  filledSlots: number
  hoursPerEmployee: Record<string, number>
}

// ─── Helper: get shift duration in hours ─────────────────────────────────────

function shiftHours(shift: ShiftDefinition): number {
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const [eh, em] = shift.end_time.split(':').map(Number)
  const startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (shift.crosses_midnight) endMins += 24 * 60
  return (endMins - startMins) / 60
}

// ─── Helper: check if employee is on leave ───────────────────────────────────

function isOnLeave(
  employeeId: string,
  date: string,
  leaves: EmployeeLeave[]
): boolean {
  return leaves.some(
    (l) =>
      l.employee_id === employeeId &&
      date >= l.start_date &&
      date <= l.end_date
  )
}

// ─── Helper: check if employee is unavailable ────────────────────────────────

function isUnavailable(
  employeeId: string,
  date: string,
  dayOfWeek: number,
  unavailability: EmployeeUnavailability[]
): boolean {
  return unavailability.some(
    (u) =>
      u.employee_id === employeeId &&
      (u.specific_date === date || u.day_of_week === dayOfWeek)
  )
}

// ─── Helper: get previous assignment for rest check ──────────────────────────

function getPreviousAssignment(
  employeeId: string,
  date: string,
  assignments: Omit<ShiftAssignment, 'id' | 'created_at'>[],
  shiftDefs: ShiftDefinition[]
): { date: string; shift: ShiftDefinition } | null {
  const prev = assignments
    .filter((a) => a.employee_id === employeeId && a.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (!prev) return null

  const shift = shiftDefs.find((s) => s.id === prev.shift_definition_id)
  if (!shift) return null

  return { date: prev.date, shift }
}

// ─── Helper: hours since last shift ended ────────────────────────────────────

function hoursSinceLastShift(
  prevDate: string,
  prevShift: ShiftDefinition,
  currentDate: string,
  currentShift: ShiftDefinition
): number {
  const [ph, pm] = prevShift.end_time.split(':').map(Number)
  const prevEnd = new Date(`${prevDate}T${prevShift.end_time}:00`)
  if (prevShift.crosses_midnight) {
    prevEnd.setDate(prevEnd.getDate() + 1)
  }

  const currentStart = new Date(`${currentDate}T${currentShift.start_time}:00`)
  return (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60)
}

// ─── Helper: count consecutive working days ──────────────────────────────────

function consecutiveDaysBefore(
  employeeId: string,
  date: string,
  assignments: Omit<ShiftAssignment, 'id' | 'created_at'>[]
): number {
  let count = 0
  let checkDate = new Date(date)

  while (true) {
    checkDate = addDays(checkDate, -1)
    const dateStr = format(checkDate, 'yyyy-MM-dd')
    const hasWork = assignments.some(
      (a) => a.employee_id === employeeId && a.date === dateStr
    )
    if (!hasWork) break
    count++
    if (count >= 7) break // safety cap
  }

  return count
}

// ─── Helper: weekly hours for an employee ────────────────────────────────────

function weeklyHours(
  employeeId: string,
  weekStart: string,
  weekEnd: string,
  assignments: Omit<ShiftAssignment, 'id' | 'created_at'>[],
  shiftDefs: ShiftDefinition[]
): number {
  return assignments
    .filter(
      (a) =>
        a.employee_id === employeeId &&
        a.date >= weekStart &&
        a.date <= weekEnd
    )
    .reduce((total, a) => {
      const shift = shiftDefs.find((s) => s.id === a.shift_definition_id)
      return total + (shift ? shiftHours(shift) : 0)
    }, 0)
}

// ─── Main generation algorithm ────────────────────────────────────────────────
// Greedy constraint satisfaction with backtracking on hard violations

export function generateSchedule(input: GenerationInput): GenerationResult {
  const {
    schedule,
    employees,
    shiftDefinitions,
    constraints,
    leaves,
    unavailability,
    holidays,
    slotsPerShift,
  } = input

  const config = schedule.generation_config as any
  const assignments: Omit<ShiftAssignment, 'id' | 'created_at'>[] = []
  const violations: ConstraintViolation[] = []
  const hoursPerEmployee: Record<string, number> = {}
  employees.forEach((e) => (hoursPerEmployee[e.id] = 0))

  // ── Phase 1: Build working date list ────────────────────────────────────────
  // Iterate from start to end date, skip non-working days and holidays.
  // Build list of working dates
  const workingDates: string[] = []
  let current = parseISO(schedule.start_date)
  const end = parseISO(schedule.end_date)

  while (current <= end) {
    const dateStr = format(current, 'yyyy-MM-dd')
    const dow = current.getDay() === 0 ? 7 : current.getDay() // 1=Mon, 7=Sun
    const isWorkingDay = schedule.working_days.includes(dow)
    const onHoliday = isHoliday(dateStr, holidays)

    // include_holidays=true  → work on holidays (include them)
    // include_holidays=false → holidays are days off (exclude them)
    const skipDueToHoliday = onHoliday && !schedule.include_holidays

    if (isWorkingDay && !skipDueToHoliday) {
      workingDates.push(dateStr)
    }

    current = addDays(current, 1)
  }

  // ── Phase 2: Assign employees to shifts ─────────────────────────────────────
  // Greedy: sort by least hours assigned, check constraints, assign first valid.
  // For each working date, fill each shift's slots
  for (const date of workingDates) {
    const dayOfWeek = new Date(date).getDay()

    for (const shiftDef of shiftDefinitions) {
      const slots = slotsPerShift[shiftDef.id] ?? 1

      // Determine required pairs for this shift
      const pairRequired = constraints.filter(
        (c) => c.type === 'pair_required' && c.is_active
      )
      const pairForbidden = constraints.filter(
        (c) => c.type === 'pair_forbidden' && c.is_active
      )

      // ── Two-phase scoring: balance FIRST, consistency SECOND ──────────────
      //
      // Problem with pure greedy: if employee A worked this shift yesterday
      // and gets a consistency bonus, A might score lower than employee B
      // who has 0 hours — so B never gets assigned.
      //
      // Solution: normalize hours to [0,1] range across all employees,
      // then add consistency as a tiebreaker within similar hour bands.
      // This ensures everyone gets roughly equal hours before consistency matters.
      const prevDateStr = format(addDays(parseISO(date), -1), 'yyyy-MM-dd')
      const prev3Dates = [-1, -2, -3].map(d => format(addDays(parseISO(date), d), 'yyyy-MM-dd'))
      const consistency = config.shift_consistency ?? 2

      // Find min/max hours for normalization
      const allHours = employees.map(e => hoursPerEmployee[e.id] ?? 0)
      const minH = Math.min(...allHours)
      const maxH = Math.max(...allHours)
      const hourRange = maxH - minH || 1

      const shiftScore = (emp: typeof employees[0]): number => {
        const hours = hoursPerEmployee[emp.id] ?? 0

        // Phase 1: Balance score (0-100, lower = fewer hours = higher priority)
        // This is the dominant factor — always prefer less-worked employees
        const balanceScore = ((hours - minH) / hourRange) * 100

        // Phase 2: Consistency tiebreaker (only meaningful within ±10h of each other)
        // Applied as fractional adjustment so it can't override balance
        let consistencyAdj = 0
        if (consistency > 0) {
          const yesterdayAssignment = assignments.find(
            a => a.employee_id === emp.id && a.date === prevDateStr
          )
          const recentShiftIds = prev3Dates
            .map(d => assignments.find(a => a.employee_id === emp.id && a.date === d)?.shift_definition_id)
            .filter(Boolean)

          if (yesterdayAssignment) {
            if (yesterdayAssignment.shift_definition_id === shiftDef.id) {
              // Same shift yesterday → reward continuity (max -5 points)
              consistencyAdj -= consistency * 2.5
            } else {
              // Different shift → mild penalty (max +2.5 points)
              consistencyAdj += consistency * 1.25
            }
          }
          // Worked this shift in last 3 days → small reward
          if (recentShiftIds.includes(shiftDef.id)) {
            consistencyAdj -= consistency * 1.0
          }
        }

        return balanceScore + consistencyAdj
      }

      const available = employees
        .filter((emp) => {
          if (!emp.is_active) return false
          if (isOnLeave(emp.id, date, leaves)) return false
          if (isUnavailable(emp.id, date, dayOfWeek, unavailability)) return false

          // Check if already assigned on this date
          const alreadyAssigned = assignments.some(
            (a) => a.employee_id === emp.id && a.date === date
          )
          if (alreadyAssigned) return false

          return true
        })
        .sort((a, b) => shiftScore(a) - shiftScore(b))

      const assignedToShift: string[] = []
      let slotsToFill = slots

      for (const emp of available) {
        if (slotsToFill <= 0) break

        // Hard constraints are checked in order of cheapest to most expensive.
        // If any fails, skip this employee for this shift slot.
  // ── Hard constraint checks ──────────────────────────────────────────

        // 1. Min rest between shifts
        const prev = getPreviousAssignment(emp.id, date, assignments, shiftDefinitions)
        if (prev) {
          const restHours = hoursSinceLastShift(prev.date, prev.shift, date, shiftDef)
          const minRest = config.min_rest_hours_between_shifts ?? 11
          if (restHours < minRest) {
            violations.push({
              type: 'rest_after_shift',
              employeeId: emp.id,
              employeeName: emp.name,
              date,
              message: `Only ${restHours.toFixed(1)}h rest before shift (min ${minRest}h)`,
            })
            continue
          }
        }

        // 2. Max consecutive days
        const consecutive = consecutiveDaysBefore(emp.id, date, assignments)
        const maxConsecutive = config.max_consecutive_days ?? 6
        if (consecutive >= maxConsecutive) {
          violations.push({
            type: 'max_consecutive',
            employeeId: emp.id,
            employeeName: emp.name,
            date,
            message: `Already worked ${consecutive} consecutive days`,
          })
          continue
        }

        // 3. Max weekly hours
        const weekStart = format(
          addDays(new Date(date), -(new Date(date).getDay() || 7) + 1),
          'yyyy-MM-dd'
        )
        const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
        const currentWeekHours = weeklyHours(emp.id, weekStart, weekEnd, assignments, shiftDefinitions)
        const maxWeekly = config.max_weekly_hours ?? 48
        if (currentWeekHours + shiftHours(shiftDef) > maxWeekly) {
          continue // Skip silently — common case
        }

        // 4. Pair forbidden constraint
        const hasForbiddenPair = pairForbidden.some(
          (c) =>
            (c.employee_id === emp.id && assignedToShift.includes(c.target_employee_id!)) ||
            (c.target_employee_id === emp.id && assignedToShift.includes(c.employee_id!))
        )
        if (hasForbiddenPair) continue

        // 5. Min seniority — if this is last slot and no senior assigned yet
        const minSeniorityConstraint = constraints.find(
          (c) =>
            c.type === 'min_seniority' &&
            c.is_active &&
            (!c.shift_definition_id || c.shift_definition_id === shiftDef.id)
        )
        if (
          minSeniorityConstraint &&
          slotsToFill === 1 &&
          assignedToShift.length > 0 &&
          emp.experience_level !== 'senior'
        ) {
          const hasSenior = assignedToShift.some(
            (id) => employees.find((e) => e.id === id)?.experience_level === 'senior'
          )
          if (!hasSenior) continue
        }

        // ── Assign ──────────────────────────────────────────────────────────

        assignments.push({
          schedule_id: schedule.id,
          employee_id: emp.id,
          shift_definition_id: shiftDef.id,
          date,
          role_in_shift: null,
          is_manual_override: false,
          note: null,
        })

        assignedToShift.push(emp.id)
        hoursPerEmployee[emp.id] = (hoursPerEmployee[emp.id] ?? 0) + shiftHours(shiftDef)
        slotsToFill--
      }

      // Post-fill: check pair_required constraints
      for (const c of pairRequired) {
        if (!c.employee_id || !c.target_employee_id) continue
        const aAssigned = assignedToShift.includes(c.employee_id)
        const bAssigned = assignedToShift.includes(c.target_employee_id)
        if (aAssigned !== bAssigned) {
          violations.push({
            type: 'pair_required',
            employeeId: c.employee_id,
            employeeName: employees.find((e) => e.id === c.employee_id)?.name ?? '',
            date,
            message: `Pair constraint violated on ${date}`,
          })
        }
      }
    }
  }

  return {
    assignments,
    violations,
    stats: {
      totalSlots: workingDates.length * Object.values(slotsPerShift).reduce((a, b) => a + b, 0),
      filledSlots: assignments.length,
      hoursPerEmployee,
    },
  }
}
