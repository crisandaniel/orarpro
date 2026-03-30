// DEPRECATED — greedy fallback removed in v3.
// CP-SAT only. If solver fails, show clear error.
// Kept for reference only — not imported anywhere.

// greedy-school.ts — Greedy fallback for school timetable generation.
//
// Used when CP-SAT solver is unavailable or times out.
// Simplified v3: no teachers/rooms in model — only class × subject × slot.
// Teachers and rooms are metadata added post-solve from class_subjects.
//
// Constraints implemented:
//   HARD: class once per slot, max 1 subject/day (or 2 if consecutive),
//         consecutive pairs placed together, no gaps at start of day (startFromFirst)
//   SOFT: hard subjects placed earlier, round-robin across days
//
// Used by: /api/schedules/[id]/generate-school/route.ts

interface CS {
  class_id: string
  subject_id: string
  teacher_id?: string | null
  periods_per_week: number
  requires_consecutive: boolean
  school_subjects?: { difficulty?: string } | null
}

interface Lesson {
  class_id: string
  subject_id: string
  day: number
  period: number
}

interface Config {
  startFromFirst?: boolean
  maxPerDay?: number
}

export function greedySchoolTimetable(
  classSubjects: CS[],
  daysPerWeek: number,
  periodsPerDay: number,
  config: Config = {}
): Lesson[] {
  const lessons: Lesson[] = []
  const startFromFirst = config.startFromFirst ?? true
  const maxPerDay = config.maxPerDay ?? periodsPerDay

  // ── Busy slot tracking ───────────────────────────────────────────────────
  const classBusy    = new Set<string>()  // `${class_id}|${day}|${period}`
  const teacherBusy  = new Set<string>()  // `${teacher_id}|${day}|${period}`
  const subjClassDay = new Set<string>()  // `${subject_id}|${class_id}|${day}`
  const classDayLoad = new Map<string, number>()  // `${class_id}|${day}` → count

  const bKey = (classId: string, day: number, period: number) => `${classId}|${day}|${period}`
  const sKey = (subjectId: string, classId: string, day: number) => `${subjectId}|${classId}|${day}`
  const dKey = (classId: string, day: number) => `${classId}|${day}`

  // ── Slot checks ──────────────────────────────────────────────────────────
  function isSlotFree(classId: string, subjectId: string, day: number, period: number, teacherId?: string | null): boolean {
    if (classBusy.has(bKey(classId, day, period))) return false
    if (teacherId && teacherBusy.has(`${teacherId}|${day}|${period}`)) return false
    if (subjClassDay.has(sKey(subjectId, classId, day))) return false
    if ((classDayLoad.get(dKey(classId, day)) ?? 0) >= maxPerDay) return false
    if (startFromFirst && period > 0) {
      // Must fill period 0 before period 1, etc.
      if (!classBusy.has(bKey(classId, day, 0))) return false
      if (!classBusy.has(bKey(classId, day, period - 1))) return false
    }
    return true
  }

  function markSlot(classId: string, subjectId: string, day: number, period: number, teacherId?: string | null) {
    classBusy.add(bKey(classId, day, period))
    if (teacherId) teacherBusy.add(`${teacherId}|${day}|${period}`)
    subjClassDay.add(sKey(subjectId, classId, day))
    classDayLoad.set(dKey(classId, day), (classDayLoad.get(dKey(classId, day)) ?? 0) + 1)
  }

  // ── Sort: harder/more-hours assignments first ─────────────────────────────
  // Sort: hard subjects first, then by periods_per_week desc
  const sorted = [...classSubjects].sort((a, b) => {
    const dA = a.school_subjects?.difficulty === 'hard' ? 0 : 1
    const dB = b.school_subjects?.difficulty === 'hard' ? 0 : 1
    if (dA !== dB) return dA - dB
    return b.periods_per_week - a.periods_per_week
  })

  // ── Place each assignment ─────────────────────────────────────────────────
  for (const cs of sorted) {
    const { class_id, subject_id, teacher_id, periods_per_week, requires_consecutive } = cs
    let placed = 0

    if (requires_consecutive) {
      // Place 2h pairs round-robin across days
      const pairsNeeded = Math.ceil(periods_per_week / 2)
      for (let dayOffset = 0; dayOffset < daysPerWeek * 2 && placed < periods_per_week; dayOffset++) {
        const day = dayOffset % daysPerWeek
        if (subjClassDay.has(sKey(subject_id, class_id, day))) continue
        for (let p = 0; p < periodsPerDay - 1; p++) {
          if (isSlotFree(class_id, subject_id, day, p, teacher_id) && !classBusy.has(bKey(class_id, day, p + 1)) && (!teacher_id || !teacherBusy.has(`${teacher_id}|${day}|${p + 1}`))) {
            lessons.push({ class_id, subject_id, day, period: p })
            lessons.push({ class_id, subject_id, day, period: p + 1 })
            markSlot(class_id, subject_id, day, p, teacher_id)
            markSlot(class_id, subject_id, day, p + 1, teacher_id)
            placed += 2
            break
          }
        }
      }
    } else {
      // Single periods — round-robin across days
      for (let dayOffset = 0; dayOffset < daysPerWeek * 2 && placed < periods_per_week; dayOffset++) {
        const day = dayOffset % daysPerWeek
        if (subjClassDay.has(sKey(subject_id, class_id, day))) continue
        for (let p = 0; p < periodsPerDay; p++) {
          if (isSlotFree(class_id, subject_id, day, p, teacher_id)) {
            lessons.push({ class_id, subject_id, day, period: p })
            markSlot(class_id, subject_id, day, p, teacher_id)
            placed++
            break
          }
        }
      }
      // Fallback: try all without day restriction
      if (placed < periods_per_week) {
        for (let day = 0; day < daysPerWeek && placed < periods_per_week; day++) {
          for (let p = 0; p < periodsPerDay && placed < periods_per_week; p++) {
            if (classBusy.has(bKey(class_id, day, p))) continue
            if (subjClassDay.has(sKey(subject_id, class_id, day))) continue
            if (teacher_id && teacherBusy.has(`${teacher_id}|${day}|${p}`)) continue
            lessons.push({ class_id, subject_id, day, period: p })
            markSlot(class_id, subject_id, day, p, teacher_id)
            placed++
          }
        }
      }
    }
  }

  return lessons
}
