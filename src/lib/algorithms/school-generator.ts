// Schedule generator for school/university timetables.
// Optimizes to minimize free periods (windows) between classes for each teacher.
// Used by: /api/schedules/[id]/generate (when schedule.type === 'school').

import { addDays, format, getDay, parseISO } from 'date-fns'

export interface TeacherSubject {
  employee_id: string
  subject_id: string
  hours_per_week: number
}

export interface Teacher {
  id: string
  name: string
  experience_level: string
}

export interface Subject {
  id: string
  name: string
}

export interface TimeSlot {
  period: number     // 1-based period number
  start_time: string // HH:MM
  end_time: string
}

export interface SchoolGenerationInput {
  scheduleId: string
  startDate: string
  endDate: string
  workingDays: number[]
  holidayDates: string[]
  teachers: Teacher[]
  subjects: Subject[]
  teacherSubjects: TeacherSubject[]
  timeSlots: TimeSlot[]
  unavailability: Array<{ employee_id: string; day_of_week: number | null; specific_date: string | null }>
  leaves: Array<{ employee_id: string; start_date: string; end_date: string }>
  minWindowPeriods: number // max allowed free periods between classes per teacher per day
}

export interface SchoolAssignment {
  employee_id: string    // teacher
  subject_id: string
  date: string
  period: number
  is_manual_override: boolean
}

export interface SchoolGenerationResult {
  assignments: SchoolAssignment[]
  violations: Array<{ type: string; message: string; severity: 'error' | 'warning' }>
  stats: { totalLessons: number; windowViolations: number }
}

export class SchoolScheduleGenerator {
  private input: SchoolGenerationInput
  private assignments: SchoolAssignment[] = []
  private violations: SchoolGenerationResult['violations'] = []

  constructor(input: SchoolGenerationInput) {
    this.input = input
  }

  generate(): SchoolGenerationResult {
    const dates = this.getWorkingDates()
    const weeksMap = this.groupByWeek(dates)

    // For each week, distribute hours_per_week across working days
    for (const [, weekDates] of weeksMap) {
      for (const ts of this.input.teacherSubjects) {
        this.distributeSubjectHours(ts, weekDates)
      }
    }

    this.checkWindowViolations()

    return {
      assignments: this.assignments,
      violations: this.violations,
      stats: {
        totalLessons: this.assignments.length,
        windowViolations: this.violations.filter(v => v.type === 'window_violation').length,
      },
    }
  }

  private distributeSubjectHours(ts: TeacherSubject, weekDates: string[]): void {
    let remaining = ts.hours_per_week

    // Shuffle dates for distribution variety
    const shuffled = [...weekDates].sort(() => Math.random() - 0.5)

    for (const date of shuffled) {
      if (remaining <= 0) break
      if (this.isTeacherUnavailable(ts.employee_id, date)) continue

      const slot = this.findFreeSlot(ts.employee_id, date)
      if (!slot) continue

      this.assignments.push({
        employee_id: ts.employee_id,
        subject_id: ts.subject_id,
        date,
        period: slot.period,
        is_manual_override: false,
      })
      remaining--
    }

    if (remaining > 0) {
      const teacher = this.input.teachers.find(t => t.id === ts.employee_id)
      const subject = this.input.subjects.find(s => s.id === ts.subject_id)
      this.violations.push({
        type: 'unscheduled_hours',
        message: `${teacher?.name} - ${subject?.name}: ${remaining} hours could not be scheduled this week`,
        severity: 'warning',
      })
    }
  }

  private findFreeSlot(teacherId: string, date: string): TimeSlot | null {
    const usedPeriods = this.assignments
      .filter(a => a.employee_id === teacherId && a.date === date)
      .map(a => a.period)

    // Find first available slot, preferring compact scheduling (no windows)
    return this.input.timeSlots.find(slot => !usedPeriods.includes(slot.period)) ?? null
  }

  private checkWindowViolations(): void {
    // Group by teacher and date
    const byTeacherDate = new Map<string, number[]>()

    for (const a of this.assignments) {
      const key = `${a.employee_id}:${a.date}`
      const periods = byTeacherDate.get(key) ?? []
      periods.push(a.period)
      byTeacherDate.set(key, periods)
    }

    for (const [key, periods] of byTeacherDate) {
      if (periods.length < 2) continue
      const sorted = [...periods].sort((a, b) => a - b)

      // Count window gaps
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1] - 1
        if (gap > this.input.minWindowPeriods) {
          const [teacherId, date] = key.split(':')
          const teacher = this.input.teachers.find(t => t.id === teacherId)
          this.violations.push({
            type: 'window_violation',
            message: `${teacher?.name} has ${gap} free period(s) between classes on ${date}`,
            severity: 'warning',
          })
        }
      }
    }
  }

  private isTeacherUnavailable(teacherId: string, date: string): boolean {
    const dayOfWeek = getDay(parseISO(date))

    const onLeave = this.input.leaves.some(
      l => l.employee_id === teacherId && l.start_date <= date && l.end_date >= date
    )
    if (onLeave) return true

    return this.input.unavailability.some(u => {
      if (u.employee_id !== teacherId) return false
      if (u.specific_date) return u.specific_date === date
      if (u.day_of_week !== null) return u.day_of_week === dayOfWeek
      return false
    })
  }

  private getWorkingDates(): string[] {
    const dates: string[] = []
    const start = parseISO(this.input.startDate)
    const end = parseISO(this.input.endDate)
    let current = start

    while (current <= end) {
      const isoDate = format(current, 'yyyy-MM-dd')
      const dayOfWeek = getDay(current)
      const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek
      const isWorking = this.input.workingDays.includes(isoWeekday)
      const isHoliday = this.input.holidayDates.includes(isoDate)

      if (isWorking && !isHoliday) dates.push(isoDate)
      current = addDays(current, 1)
    }

    return dates
  }

  private groupByWeek(dates: string[]): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const date of dates) {
      const d = parseISO(date)
      const year = d.getFullYear()
      const week = Math.ceil(((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7)
      const key = `${year}-W${week}`
      const arr = map.get(key) ?? []
      arr.push(date)
      map.set(key, arr)
    }
    return map
  }
}
