// school-setup/feasibility.ts
// Fast-check client-side — rulează în browser înainte de a trimite la solver.
// Verifică: profesor supraîncărcat, clasă supraîncărcată, pattern invalid, sală lipsă.

import type { SchoolTeacher, SchoolSubject, SchoolClass, SchoolRoom, FeasibilityCheck, FeasibilityError } from '@/types'
import type { CellData } from './types'

export function runFeasibilityCheck(
  matrix:      Record<string, Record<string, CellData>>,
  classes:     SchoolClass[],
  subjects:    SchoolSubject[],
  teachers:    SchoolTeacher[],
  rooms:       SchoolRoom[],
  daysPerWeek: number,
  slotsPerDay: number,
): FeasibilityCheck {
  const errors: FeasibilityError[] = []
  const teacherLoad: Record<string, number> = {}
  const totalSlots = daysPerWeek * slotsPerDay

  // ── Check 0: profesor depășește sloturi disponibile ───────────────────────
  const teacherTotals = classes.reduce((acc, cls) => {
    for (const subj of subjects) {
      const cell = matrix[cls.id]?.[subj.id]
      if (cell?.weekly_hours && cell.teacher_id) {
        acc[cell.teacher_id] = (acc[cell.teacher_id] ?? 0) + cell.weekly_hours
      }
    }
    return acc
  }, {} as Record<string, number>)

  for (const [teacherId, load] of Object.entries(teacherTotals)) {
    const teacher = teachers.find(t => t.id === teacherId)
    if (!teacher) continue
    const unavail = teacher.unavailable_slots?.length ?? 0
    const avail   = totalSlots - unavail
    if ((load as number) > avail) {
      errors.push({
        type: 'teacher_overloaded', entity: teacher.name,
        detail: `${load} ore/săpt dar are doar ${avail} sloturi disponibile (${totalSlots} − ${unavail} indisponibile) ⚠ IMPOSIBIL`,
      })
    }
  }

  // ── Check per clasă ───────────────────────────────────────────────────────
  for (const cls of classes) {
    let classTotal = 0
    for (const subj of subjects) {
      const cell = matrix[cls.id]?.[subj.id]
      if (!cell || cell.weekly_hours === 0) continue

      classTotal += cell.weekly_hours
      teacherLoad[cell.teacher_id] = (teacherLoad[cell.teacher_id] ?? 0) + cell.weekly_hours

      // Pattern validation
      if (cell.lesson_pattern) {
        const sum = cell.lesson_pattern.reduce((a, b) => a + b, 0)
        if (sum !== cell.weekly_hours) {
          errors.push({ type: 'pattern_invalid', entity: `${cls.name} — ${subj.name}`,
            detail: `Pattern [${cell.lesson_pattern.join(',')}] suma ${sum} ≠ ${cell.weekly_hours} ore/săpt` })
        }
        if (cell.lesson_pattern.some(h => h > 2)) {
          errors.push({ type: 'pattern_invalid', entity: `${cls.name} — ${subj.name}`,
            detail: `Blocurile pot fi maxim 2h. Pattern: [${cell.lesson_pattern.join(',')}]` })
        }
      }

      // Room check
      if (subj.required_room_type && !rooms.some(r => r.type === subj.required_room_type)) {
        errors.push({ type: 'no_room', entity: subj.name,
          detail: `Necesită sală de tip "${subj.required_room_type}" dar nu există niciuna definită` })
      }
    }

    if (classTotal > totalSlots) {
      errors.push({ type: 'class_overloaded', entity: cls.name,
        detail: `Total ${classTotal} ore/săpt > ${totalSlots} sloturi (${daysPerWeek}z × ${slotsPerDay}sl)` })
    }

    const minDays = Math.ceil(classTotal / cls.max_lessons_per_day)
    if (minDays > daysPerWeek) {
      errors.push({ type: 'class_overloaded', entity: cls.name,
        detail: `${classTotal} ore cu max ${cls.max_lessons_per_day}/zi necesită ${minDays} zile > ${daysPerWeek}` })
    }
  }

  // ── Check per profesor ────────────────────────────────────────────────────
  for (const teacher of teachers) {
    const load = teacherLoad[teacher.id] ?? 0
    if (load === 0) continue

    const unavailCount    = teacher.unavailable_slots?.length ?? 0
    const availableSlots  = totalSlots - unavailCount
    if (load > availableSlots) {
      errors.push({ type: 'teacher_overloaded', entity: teacher.name,
        detail: `${load} ore/săpt dar are doar ${availableSlots} sloturi disponibile` })
    }
    if (teacher.max_lessons_per_week && load > teacher.max_lessons_per_week) {
      errors.push({ type: 'teacher_overloaded', entity: teacher.name,
        detail: `Asignat ${load} ore/săpt > maxim ${teacher.max_lessons_per_week}` })
    }
    if (teacher.max_lessons_per_day) {
      const minDays = Math.ceil(load / teacher.max_lessons_per_day)
      if (minDays > daysPerWeek) {
        errors.push({ type: 'teacher_overloaded', entity: teacher.name,
          detail: `${load} ore cu max ${teacher.max_lessons_per_day}/zi necesită ${minDays} zile > ${daysPerWeek}` })
      }
    }
  }

  return { ok: errors.length === 0, errors }
}
