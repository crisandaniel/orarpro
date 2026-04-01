// business-setup/feasibility.ts
// Pre-verificare client-side înainte de a trimite la solver.
// Verifică probleme comune fără a apela API-ul.

import type { Employee, ShiftDefinition } from '@/types'

export interface FeasibilityIssue {
  type: 'error' | 'warning'
  message: string
}

export interface FeasibilityResult {
  ok: boolean
  issues: FeasibilityIssue[]
  stats: {
    totalEmployees: number
    activeEmployees: number
    totalShifts: number
    totalSlotsPerDay: number
    avgShiftsPerEmployee: number // pe săptămână
    coverageRatio: number        // angajați disponibili / slots necesare
  }
}

interface FeasibilityInput {
  employees: Employee[]
  shiftDefs: ShiftDefinition[]
  slotsPerDay: Record<string, number>   // shiftId → slots/zi
  daysPerWeek: number
  maxConsecutiveDays: number
  maxWeeklyHours: number
  minRestHours: number
}

export function runBusinessFeasibilityCheck(input: FeasibilityInput): FeasibilityResult {
  const issues: FeasibilityIssue[] = []
  const {
    employees, shiftDefs, slotsPerDay,
    daysPerWeek, maxConsecutiveDays, maxWeeklyHours, minRestHours,
  } = input

  const activeEmployees = employees.filter(e => e.is_active)
  const totalSlotsPerDay = shiftDefs.reduce((sum, s) => sum + (slotsPerDay[s.id] ?? 1), 0)
  const totalSlotsPerWeek = totalSlotsPerDay * daysPerWeek

  // ── Erori critice ─────────────────────────────────────────────────────────

  if (activeEmployees.length === 0) {
    issues.push({ type: 'error', message: 'Nu există angajați activi. Adaugă angajați înainte de generare.' })
  }

  if (shiftDefs.length === 0) {
    issues.push({ type: 'error', message: 'Nu sunt definite ture. Adaugă cel puțin o tură.' })
  }

  if (activeEmployees.length > 0 && totalSlotsPerDay > 0) {
    // Verifică dacă avem suficienți angajați pentru acoperire minimă
    // Fiecare angajat poate lucra max maxConsecutiveDays din daysPerWeek
    const maxShiftsPerEmployee = Math.min(maxConsecutiveDays, daysPerWeek)
    const theoreticalMaxCoverage = activeEmployees.length * maxShiftsPerEmployee
    if (theoreticalMaxCoverage < totalSlotsPerWeek) {
      issues.push({
        type: 'error',
        message: `Acoperire imposibilă: ${activeEmployees.length} angajați × max ${maxShiftsPerEmployee} zile = ${theoreticalMaxCoverage} ture/săpt, dar sunt necesare ${totalSlotsPerWeek} ture/săpt.`,
      })
    }
  }

  // ── Verificări ture ────────────────────────────────────────────────────────

  for (const shift of shiftDefs) {
    if (!shift.start_time || !shift.end_time) {
      issues.push({ type: 'error', message: `Tura "${shift.name}" nu are ore de start/end setate.` })
      continue
    }

    // Calculează durata turei
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    let durationH = (eh * 60 + em - (sh * 60 + sm)) / 60
    if (shift.crosses_midnight) durationH += 24

    if (durationH <= 0) {
      issues.push({ type: 'error', message: `Tura "${shift.name}" are durată negativă sau zero.` })
    }
    if (durationH > maxWeeklyHours) {
      issues.push({ type: 'warning', message: `Tura "${shift.name}" durează ${durationH}h — mai mult decât max_weekly_hours (${maxWeeklyHours}h).` })
    }
  }

  // ── Verificare repaus între ture ──────────────────────────────────────────

  if (shiftDefs.length >= 2) {
    // Verifică dacă există perechi de ture consecutive cu repaus insuficient
    for (let i = 0; i < shiftDefs.length; i++) {
      for (let j = 0; j < shiftDefs.length; j++) {
        if (i === j) continue
        const a = shiftDefs[i]
        const b = shiftDefs[j]
        if (!a.end_time || !b.start_time) continue

        const [aeh, aem] = a.end_time.split(':').map(Number)
        const [bsh, bsm] = b.start_time.split(':').map(Number)
        let restH = (bsh * 60 + bsm - (aeh * 60 + aem)) / 60
        if (a.crosses_midnight) restH -= 24
        if (restH < 0) restH += 24

        if (restH > 0 && restH < minRestHours) {
          issues.push({
            type: 'warning',
            message: `Repaus insuficient între "${a.name}" (${a.end_time}) și "${b.name}" (${b.start_time}): ${restH.toFixed(1)}h < ${minRestHours}h minim.`,
          })
        }
      }
    }
  }

  // ── Avertismente ──────────────────────────────────────────────────────────

  if (activeEmployees.length > 0 && totalSlotsPerWeek > 0) {
    const avgShifts = totalSlotsPerWeek / activeEmployees.length
    if (avgShifts > daysPerWeek * 0.9) {
      issues.push({
        type: 'warning',
        message: `Rata de ocupare e mare (${avgShifts.toFixed(1)} ture/angajat/săpt). Angajații vor lucra aproape în fiecare zi.`,
      })
    }
    if (avgShifts < 1) {
      issues.push({
        type: 'warning',
        message: `Prea mulți angajați pentru numărul de ture. Unii angajați pot rămâne neasignați.`,
      })
    }
  }

  const coverageRatio = totalSlotsPerWeek > 0
    ? (activeEmployees.length / totalSlotsPerWeek)
    : 0

  const avgShiftsPerEmployee = activeEmployees.length > 0
    ? totalSlotsPerWeek / activeEmployees.length
    : 0

  const hasErrors = issues.some(i => i.type === 'error')

  return {
    ok: !hasErrors,
    issues,
    stats: {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      totalShifts: shiftDefs.length,
      totalSlotsPerDay,
      avgShiftsPerEmployee: Math.round(avgShiftsPerEmployee * 10) / 10,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
    },
  }
}