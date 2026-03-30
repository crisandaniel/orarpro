'use client'

// SchoolSetupClient — configurare și generare orar școlar (v3).
//
// Flow:
//   Step 1: Curriculum  — tabel clasă×materie×profesor×ore+pattern
//   Step 2: Constraints — hard (info) + soft (slidere 0-100)
//   Step 3: Fast-check  — calcul instant în browser înainte de generare
//   Step 4: Generează   — trimite la CP-SAT
//   Step 5: Orar        — TimetableGrid + sumar + detalii pliabile
//
// Fast-check (client-side, fără API):
//   - profesor supraîncărcat (weekly_hours > max_lessons_per_week)
//   - clasă supraîncărcată (total ore > slots_per_day × days_per_week)
//   - pattern invalid (sum != weekly_hours)
//   - nicio sală compatibilă pentru o materie cu required_room_type
//
// Loguri solver: sumar vizibil + panou pliabil cu detalii per profesor/clasă.
//
// Used by: schedules/[id]/school-setup/page.tsx

import { useState, useMemo, useCallback } from 'react'
import { Settings, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { TimetableGrid } from '@/components/schedule/TimetableGrid'
import type {
  SchoolResources, SchoolTeacher, SchoolSubject, SchoolClass, SchoolRoom,
  CurriculumItem, ScheduleConfig, SoftRules, FeasibilityCheck, FeasibilityError
} from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  scheduleId:           string
  scheduleName:         string
  locale:               string
  resources:            SchoolResources
  existingConfig?:      ScheduleConfig | null
  existingCurriculum?:  CurriculumItem[]
  existingLessons?:     any[]
  existingSolverUsed?:  string
  daysPerWeek?:         number  // from org time config
  slotsPerDay?:         number
}

// Stato locale per cella curriculum: quello che l'utente sta editando
interface CellData {
  teacher_id:        string
  weekly_hours:      number
  lesson_pattern:    number[] | null   // null = auto [1,1,...,1]
  preferred_room_id: string | null
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']

const DEFAULT_SOFT_RULES: SoftRules = {
  avoidGapsForTeachers:        true,
  avoidLastHourForStages:       ['primary', 'middle'],
  avoidSameSubjectTwicePerDay:  true,
  hardSubjectsMorning:          true,
  startFromFirstSlot:           true,
  weights: { teacherGaps: 80, lastHour: 60, sameSubject: 70, hardMorning: 50, startFirst: 90 },
}

const inp: React.CSSProperties = {
  border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '7px 10px',
  fontSize: '13px', width: '100%', boxSizing: 'border-box' as const, background: '#fff', color: '#111827',
}

// ── Fast-check (client-side) ──────────────────────────────────────────────────

function runFeasibilityCheck(
  matrix:     Record<string, Record<string, CellData>>,
  classes:    SchoolClass[],
  subjects:   SchoolSubject[],
  teachers:   SchoolTeacher[],
  rooms:      SchoolRoom[],
  daysPerWeek: number,
  slotsPerDay: number,
): FeasibilityCheck {
  const errors: FeasibilityError[] = []
  const teacherLoad: Record<string, number> = {}

  // ── Check 0: Total lecții vs total sloturi disponibile ───────────────────
  // Cel mai simplu check — dacă total ore > total sloturi, e imposibil
  const totalSlots = daysPerWeek * slotsPerDay
  let grandTotalLessons = 0
  for (const cls of classes) {
    for (const subj of subjects) {
      const cell = matrix[cls.id]?.[subj.id]
      if (cell && cell.weekly_hours > 0) grandTotalLessons += cell.weekly_hours
    }
  }
  // Verificare per profesor: dacă un profesor are mai ore decât sloturi disponibile
  // (verificat mai jos per profesor cu indisponibilități)
  // Verificare globală rapidă: dacă orice singur profesor depășește totalSlots
  for (const [teacherId, load] of Object.entries(
    classes.reduce((acc, cls) => {
      for (const subj of subjects) {
        const cell = matrix[cls.id]?.[subj.id]
        if (cell?.weekly_hours && cell.teacher_id) {
          acc[cell.teacher_id] = (acc[cell.teacher_id] ?? 0) + cell.weekly_hours
        }
      }
      return acc
    }, {} as Record<string, number>)
  )) {
    const teacher = teachers.find(t => t.id === teacherId)
    if (!teacher) continue
    const unavail = teacher.unavailable_slots?.length ?? 0
    const avail   = totalSlots - unavail
    if ((load as number) > avail) {
      errors.push({
        type: 'teacher_overloaded',
        entity: teacher.name,
        detail: `${load} ore/săpt dar are doar ${avail} sloturi disponibile (${totalSlots} total − ${unavail} indisponibile) ⚠ IMPOSIBIL`,
      })
    }
  }

  for (const cls of classes) {
    let classTotal = 0
    for (const subj of subjects) {
      const cell = matrix[cls.id]?.[subj.id]
      if (!cell || cell.weekly_hours === 0) continue

      classTotal += cell.weekly_hours

      // Accumulate teacher load
      teacherLoad[cell.teacher_id] = (teacherLoad[cell.teacher_id] ?? 0) + cell.weekly_hours

      // Pattern validation
      if (cell.lesson_pattern) {
        const patternSum = cell.lesson_pattern.reduce((a, b) => a + b, 0)
        if (patternSum !== cell.weekly_hours) {
          errors.push({
            type: 'pattern_invalid',
            entity: `${cls.name} — ${subj.name}`,
            detail: `Pattern [${cell.lesson_pattern.join(',')}] suma ${patternSum} ≠ ${cell.weekly_hours} ore/săpt`,
          })
        }
        if (cell.lesson_pattern.some(h => h > 2)) {
          errors.push({
            type: 'pattern_invalid',
            entity: `${cls.name} — ${subj.name}`,
            detail: `Blocurile pot fi maxim 2h. Pattern: [${cell.lesson_pattern.join(',')}]`,
          })
        }
      }

      // Room check
      if (subj.required_room_type) {
        const hasRoom = rooms.some(r => r.type === subj.required_room_type)
        if (!hasRoom) {
          errors.push({
            type: 'no_room',
            entity: subj.name,
            detail: `Necesită sală de tip "${subj.required_room_type}" dar nu există niciuna definită`,
          })
        }
      }
    }

    // Class overload
    const maxSlots = daysPerWeek * slotsPerDay
    if (classTotal > maxSlots) {
      errors.push({
        type: 'class_overloaded',
        entity: cls.name,
        detail: `Total ${classTotal} ore/săpt > ${maxSlots} sloturi disponibile (${daysPerWeek}z × ${slotsPerDay}sl)`,
      })
    }

    // Class max per day
    const minDaysNeeded = Math.ceil(classTotal / cls.max_lessons_per_day)
    if (minDaysNeeded > daysPerWeek) {
      errors.push({
        type: 'class_overloaded',
        entity: cls.name,
        detail: `${classTotal} ore cu max ${cls.max_lessons_per_day}/zi necesită cel puțin ${minDaysNeeded} zile > ${daysPerWeek} disponibile`,
      })
    }
  }

  // Teacher overload
  for (const teacher of teachers) {
    const load = teacherLoad[teacher.id] ?? 0
    if (load === 0) continue

    // Sloturi disponibile după indisponibilități
    const unavailCount = teacher.unavailable_slots?.length ?? 0
    const availableSlots = totalSlots - unavailCount
    if (load > availableSlots) {
      errors.push({
        type: 'teacher_overloaded',
        entity: teacher.name,
        detail: `${load} ore/săpt dar are doar ${availableSlots} sloturi disponibile (${totalSlots} total − ${unavailCount} indisponibile)`,
      })
    }

    if (teacher.max_lessons_per_week && load > teacher.max_lessons_per_week) {
      errors.push({
        type: 'teacher_overloaded',
        entity: teacher.name,
        detail: `Asignat ${load} ore/săpt > maxim ${teacher.max_lessons_per_week}`,
      })
    }
    if (teacher.max_lessons_per_day) {
      const minDays = Math.ceil(load / teacher.max_lessons_per_day)
      if (minDays > daysPerWeek) {
        errors.push({
          type: 'teacher_overloaded',
          entity: teacher.name,
          detail: `${load} ore cu max ${teacher.max_lessons_per_day}/zi necesită cel puțin ${minDays} zile > ${daysPerWeek} disponibile`,
        })
      }
    }
  }

  return { ok: errors.length === 0, errors }
}


// ── MultiEditForm — formular pentru editare multiplă clase ───────────────────
// Folosit când utilizatorul Ctrl+Click pe celule din aceeași coloană (materie).

function MultiEditForm({
  firstCell,
  teachers,
  onApply,
}: {
  firstCell: CellData | undefined
  teachers: { id: string; name: string }[]
  onApply: (hours: number, pattern: number[] | null, teacherId: string) => void
}) {
  const [hours,     setHours]     = useState(firstCell?.weekly_hours ?? 0)
  const [patternStr,setPatternStr]= useState(firstCell?.lesson_pattern?.join(',') ?? '')
  const [teacherId, setTeacherId] = useState(firstCell?.teacher_id ?? '')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        Ore/săpt
        <input type="number" min={0} max={20} value={hours}
          onChange={e => setHours(+e.target.value)}
          style={{ border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '6px 8px',
            fontSize: '13px', width: '100%', boxSizing: 'border-box' as const, marginTop: '3px',
            background: '#fff', color: '#111827' }} />
      </label>
      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        Pattern (ex: 2,1,1)
        <input type="text" value={patternStr}
          placeholder={`implicit: ${Array(hours || 2).fill(1).join(',')}`}
          onChange={e => setPatternStr(e.target.value)}
          style={{ border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '6px 8px',
            fontSize: '13px', width: '100%', boxSizing: 'border-box' as const, marginTop: '3px',
            background: '#fff', color: '#111827' }} />
      </label>
      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        Profesor <span style={{ color: 'var(--color-text-danger)' }}>*</span>
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
          style={{ border: `0.5px solid ${!teacherId ? '#fca5a5' : '#d1d5db'}`,
            borderRadius: '8px', padding: '6px 8px',
            fontSize: '13px', width: '100%', boxSizing: 'border-box' as const, marginTop: '3px',
            cursor: 'pointer', background: '#fff', color: '#111827' }}>
          <option value="">— selectează —</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <button
        onClick={() => {
          const pattern = patternStr ? patternStr.split(',').map(Number).filter(n => n > 0) : null
          onApply(hours, pattern, teacherId)
        }}
        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
        Aplică la toate
      </button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchoolSetupClient({
  scheduleId, scheduleName, locale, resources,
  existingConfig, existingCurriculum = [], existingLessons = [],
  existingSolverUsed, daysPerWeek = 5, slotsPerDay = 8,
}: Props) {
  const { teachers, subjects, classes, rooms } = resources

  // ── Config state ──────────────────────────────────────────────────────────
  const [days,         setDays]         = useState(existingConfig?.days_per_week    ?? daysPerWeek)
  const [slots,        setSlots]        = useState(Math.min(existingConfig?.slots_per_day ?? slotsPerDay, slotsPerDay))
  const [slotDuration, setSlotDuration] = useState(existingConfig?.slot_duration    ?? 50)
  const [firstSlot,    setFirstSlot]    = useState(existingConfig?.first_slot_start ?? '08:00')
  const [softRules,    setSoftRules]    = useState<SoftRules>(() => {
    const saved = existingConfig?.soft_rules
    if (!saved) return DEFAULT_SOFT_RULES
    // Normalizare: asigurăm că toate câmpurile au tipul corect
    return {
      ...DEFAULT_SOFT_RULES,
      ...saved,
      // avoidLastHourForStages poate fi false (bool) din DB vechi — normalizăm
      avoidLastHourForStages: saved.avoidLastHourForStages === false
        ? false
        : Array.isArray(saved.avoidLastHourForStages)
          ? saved.avoidLastHourForStages
          : ['primary', 'middle'],
      weights: { ...DEFAULT_SOFT_RULES.weights, ...(saved.weights ?? {}) },
    } as SoftRules
  })

  // ── Curriculum matrix state ───────────────────────────────────────────────
  // matrix[classId][subjectId] = CellData
  const [matrix, setMatrix] = useState<Record<string, Record<string, CellData>>>(() => {
    const m: Record<string, Record<string, CellData>> = {}
    for (const cls of classes) m[cls.id] = {}
    for (const item of existingCurriculum) {
      if (!m[item.class_id]) m[item.class_id] = {}
      m[item.class_id][item.subject_id] = {
        teacher_id:        item.teacher_id,
        weekly_hours:      item.weekly_hours,
        lesson_pattern:    item.lesson_pattern ?? null,
        preferred_room_id: item.preferred_room_id ?? null,
      }
    }
    return m
  })

  // ── UI state ──────────────────────────────────────────────────────────────
  // Single cell popover
  const [activeCell,      setActiveCell]      = useState<{ classId: string; subjectId: string } | null>(null)
  // Multi-select: Ctrl+Click selects multiple cells in same column (same subject)
  const [selectedCells,   setSelectedCells]   = useState<Set<string>>(new Set())  // "classId|subjectId"
  const [multiSubjectId,  setMultiSubjectId]  = useState<string | null>(null)     // subject column being multi-edited
  const [activeTab,       setActiveTab]       = useState<'curriculum' | 'constraints'>('curriculum')
  const [showConfig,      setShowConfig]      = useState(!existingConfig)
  const [saving,          setSaving]          = useState(false)
  const [generating,      setGenerating]      = useState(false)
  const [generatedLessons,setGeneratedLessons]= useState<any[]>(existingLessons)
  const [solverUsed,      setSolverUsed]      = useState<string | undefined>(existingSolverUsed)
  const [solverInfo,      setSolverInfo]      = useState<{ cpsatReasons: string[]; generated: boolean } | null>(null)
  const [debugLog,        setDebugLog]        = useState<any[]>([])
  const [showDebug,       setShowDebug]       = useState(false)
  const [feasibility,     setFeasibility]     = useState<FeasibilityCheck | null>(null)
  const [timetableKey,    setTimetableKey]    = useState(0)

  // ── Derived ───────────────────────────────────────────────────────────────
  const curriculumList = useMemo(() => {
    const list: Array<CellData & { class_id: string; subject_id: string }> = []
    for (const cls of classes) {
      for (const subj of subjects) {
        const cell = matrix[cls.id]?.[subj.id]
        if (cell && cell.weekly_hours > 0 && cell.teacher_id) {
          list.push({ ...cell, class_id: cls.id, subject_id: subj.id })
        }
      }
    }
    return list
  }, [matrix, classes, subjects])

  function setCell(classId: string, subjectId: string, data: CellData | null) {
    setMatrix(prev => {
      const next = { ...prev, [classId]: { ...prev[classId] } }
      if (data === null) delete next[classId][subjectId]
      else next[classId][subjectId] = data
      return next
    })
    setFeasibility(null) // invalidate check on change
  }

  function updateSoftRule(key: keyof Omit<SoftRules, 'weights'>, value: any) {
    // avoidLastHourForStages e list[str] in solver — bool true → ['primary','middle'], false → false
    if (key === 'avoidLastHourForStages') {
      setSoftRules(p => ({ ...p, [key]: value === true ? ['primary', 'middle'] : false }))
    } else {
      setSoftRules(p => ({ ...p, [key]: value }))
    }
  }

  function updateWeight(key: keyof SoftRules['weights'], value: number) {
    setSoftRules(p => ({ ...p, weights: { ...p.weights, [key]: value } }))
  }

  // ── Slot time label ───────────────────────────────────────────────────────
  function slotLabel(period: number) {
    const [h, m] = firstSlot.split(':').map(Number)
    const from = h * 60 + m + period * (slotDuration + 10)
    const to   = from + slotDuration
    const fmt  = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`
    return `${fmt(from)}–${fmt(to)}`
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveAll(): Promise<boolean> {
    // Validate: all cells must have teacher
    const missing = classes.flatMap(cls =>
      subjects
        .filter(s => matrix[cls.id]?.[s.id]?.weekly_hours > 0 && !matrix[cls.id]?.[s.id]?.teacher_id)
        .map(s => `${cls.name} — ${s.name}`)
    )
    if (missing.length > 0) {
      toast.error(`Profesor lipsă: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ` +${missing.length - 2}` : ''}`)
      return false
    }

    setSaving(true)
    const res = await fetch(`/api/schedules/${scheduleId}/school-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { days, slots, slotDuration, firstSlot, softRules },
        curriculum: curriculumList,
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Eroare la salvare'); return false }
    toast.success('Salvat')
    return true
  }

  // ── Fast-check ────────────────────────────────────────────────────────────
  function runCheck() {
    const result = runFeasibilityCheck(matrix, classes, subjects, teachers, rooms, days, slots)
    setFeasibility(result)
    return result
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  async function generate() {
    // Fast-check first
    const check = runCheck()
    if (!check.ok) {
      toast.error(`Fast-check: ${check.errors.length} probleme detectate`)
      return
    }

    if (!await saveAll()) return
    setGenerating(true)
    try {
      const res    = await fetch(`/api/schedules/${scheduleId}/generate-school`, { method: 'POST' })
      const result = await res.json()

      if (!res.ok) {
        const reasons = (result.violations ?? []).map((v: any) => v.message)
        setSolverInfo({ cpsatReasons: reasons, generated: false })
        toast.error('Orar imposibil de generat')
        return
      }

      setSolverUsed(result.solver)
      setDebugLog(result.debug_log ?? [])
      setSolverInfo(null)
      toast.success(`${result.stats?.scheduled_lessons ?? 0} ore generate`)

      // Reload lessons
      const lr = await fetch(`/api/schedules/${scheduleId}/lessons`)
      if (lr.ok) {
        const data = await lr.json()
        const lessons = data.lessons ?? []
        console.log(`[generate] Loaded ${lessons.length} lessons`)
        setGeneratedLessons(lessons)
        setTimetableKey(k => k + 1)  // force TimetableGrid remount
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      } else {
        console.error('[generate] Failed to reload lessons:', lr.status)
        toast.error('Eroare la încărcarea orarului')
      }
    } catch { toast.error('Eroare la generare') }
    finally  { setGenerating(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          {scheduleName}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', margin: 0 }}>
          Configurează curriculum și generează orarul
        </p>
      </div>

      {/* ── Timetable — full width, above config ──────────────────────────── */}
      {generatedLessons.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                Orar generat
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', margin: '2px 0 0' }}>
                {generatedLessons.length} ore
                {solverUsed && (
                  <span style={{ marginLeft: '8px', fontWeight: 500, padding: '1px 8px',
                    borderRadius: '20px', background: '#f0fdf4', color: '#059669',
                    border: '0.5px solid #bbf7d0' }}>
                    ✓ CP-SAT
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => setGeneratedLessons([])}
              style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ascunde
            </button>
          </div>
          <TimetableGrid
            key={timetableKey}
            lessons={generatedLessons as any}
            teachers={teachers as any}
            subjects={subjects as any}
            classes={classes as any}
            rooms={rooms as any}
            periodsPerDay={slots}
            periodDuration={slotDuration}
            firstPeriodStart={firstSlot}
            workingDays={Array.from({ length: days }, (_, i) => i)}
            scheduleId={scheduleId}
            locale={locale}
          />
        </div>
      )}

      {/* ── Solver info (erori CP-SAT) ────────────────────────────────────── */}
      {solverInfo && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px',
          background: '#fef2f2', border: '0.5px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#dc2626', margin: '0 0 8px' }}>
                Găsirea soluției optime a eșuat din următoarele motive:
              </p>
              {solverInfo.cpsatReasons.map((r, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#7f1d1d', margin: '2px 0', paddingLeft: '8px' }}>
                  • {r}
                </p>
              ))}
            </div>
            <button onClick={() => setSolverInfo(null)}
              style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '12px' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Debug log (sumar + detalii pliabile) ─────────────────────────── */}
      {debugLog.length > 0 && (
        <div style={{ marginBottom: '24px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Sumar — mereu vizibil */}
          {(() => {
            const summary = debugLog.find(e => e.type === 'summary')
            const status  = debugLog.find(e => e.type === 'solver_status')
            return summary ? (
              <div style={{ padding: '12px 16px', background: '#f9fafb',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                  <span>
                    <strong style={{ color: summary.violations > 0 ? '#dc2626' : '#059669' }}>
                      {summary.scheduled}/{summary.total}
                    </strong> ore generate
                  </span>
                  {status && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {status.status} în {status.time_seconds}s
                    </span>
                  )}
                  {summary.violations > 0 && (
                    <span style={{ color: '#dc2626' }}>⚠ {summary.violations} probleme</span>
                  )}
                </div>
                <button onClick={() => setShowDebug(p => !p)}
                  style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Detalii {showDebug ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
              </div>
            ) : null
          })()}

          {/* Detalii pliabile */}
          {showDebug && (
            <div style={{ padding: '14px 16px', background: '#fff', fontSize: '12px' }}>
              {/* Assignments */}
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Asignări trimise
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
                {debugLog.filter(e => e.type === 'assignment').map((e, i) => {
                  const t = teachers.find(t => t.id === e.teacher_id)
                  const s = subjects.find(s => s.id === e.subject_id)
                  const c = classes.find(c => c.id === e.class_id)
                  return (
                    <p key={i} style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-primary)' }}>
                      {t?.name ?? e.teacher_id?.slice(0,8)} → <strong>{s?.name ?? e.subject_id?.slice(0,8)}</strong> → {c?.name ?? e.class_id?.slice(0,8)} × {e.weekly_hours}h{e.lesson_pattern ? ` [${e.lesson_pattern.join(',')}]` : ''}
                    </p>
                  )
                })}
              </div>

              {/* Per-teacher results */}
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Distribuție profesori
              </p>
              {debugLog.filter(e => e.type === 'teacher_result').map((e, i) => {
                const t = teachers.find(t => t.id === e.teacher_id)
                const slotsStr = (e.slots ?? [])
                  .map((s: number[]) => `${DAY_NAMES[s[0]]}:S${s[1]+1}`)
                  .join(' · ')
                return (
                  <div key={i} style={{ marginBottom: '6px', padding: '6px 10px', borderRadius: '6px',
                    background: e.conflict ? '#fef2f2' : '#f9fafb' }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 500,
                      color: e.conflict ? '#dc2626' : '#111827', fontSize: '12px' }}>
                      {t?.name ?? e.teacher_id?.slice(0,8)}: {e.lessons} lecții
                      {e.conflict && <span style={{ color: '#dc2626' }}> ⚠ CONFLICT</span>}
                    </p>
                    <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                      {slotsStr}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Setup — 2 coloane ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>
      <div>

        {/* ── Config generală (pliabilă) ──────────────────────────────────── */}
        <div style={{ marginBottom: '16px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>
          <button onClick={() => setShowConfig(p => !p)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', background: '#f9fafb', border: 'none', cursor: 'pointer' }}>
            <Settings style={{ width: '16px', height: '16px', color: 'var(--color-text-secondary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1, textAlign: 'left' }}>
              Configurare grilă
            </span>
            {showConfig
              ? <ChevronUp style={{ width: '14px', color: 'var(--color-text-tertiary)' }} />
              : <ChevronDown style={{ width: '14px', color: 'var(--color-text-tertiary)' }} />}
          </button>
          {showConfig && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {[
                  { label: 'Zile/săpt',    value: days,        set: setDays,        type: 'number', min: 1, max: 7 },
                  { label: `Sloturi/zi (max ${slotsPerDay})`, value: slots, set: (v: number) => setSlots(Math.min(v, slotsPerDay)), type: 'number', min: 1, max: slotsPerDay },
                  { label: 'Durată (min)', value: slotDuration,set: setSlotDuration,type: 'number', min: 30, max: 120 },
                  { label: 'Prima oră',    value: firstSlot,   set: setFirstSlot,   type: 'time' },
                ].map(({ label, value, set, type, min, max }: any) => (
                  <label key={label} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {label}
                    <input type={type} min={min} max={max} value={value}
                      onChange={e => set(type === 'number' ? +e.target.value : e.target.value)}
                      style={{ ...inp, marginTop: '4px' }} />
                  </label>
                ))}
              </div>
              {/* Slot preview */}
              <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>PREVIEW</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Array.from({ length: Math.min(slots, 12) }, (_, i) => (
                  <span key={i} style={{ fontSize: '11px', color: 'var(--color-text-primary)',
                    background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px' }}>
                    S{i+1}: {slotLabel(i)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs: Curriculum | Constraints ─────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', marginBottom: '16px' }}>
          {(['curriculum', 'constraints'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, marginBottom: '-1px',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab ? '#1d4ed8' : '#6b7280' }}>
              {tab === 'curriculum' ? `Curriculum (${curriculumList.length})` : 'Constrângeri'}
            </button>
          ))}
        </div>

        {/* ── Curriculum tab ─────────────────────────────────────────────── */}
        {activeTab === 'curriculum' && (
          <div>
            {classes.length === 0 || subjects.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', padding: '32px',
                textAlign: 'center', border: '0.5px dashed #e5e7eb', borderRadius: '12px' }}>
                Adaugă clase și materii în <strong>Resurse</strong> înainte.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', background: '#f9fafb',
                        border: '0.5px solid #d1d5db', fontWeight: 500, color: 'var(--color-text-primary)',
                        textAlign: 'left', position: 'sticky', left: 0, zIndex: 1 }}>
                        Clasă
                      </th>
                      {subjects.map(s => (
                        <th key={s.id} style={{ padding: '8px 10px', background: '#f9fafb',
                          border: '0.5px solid #d1d5db', fontWeight: 500, color: 'var(--color-text-primary)',
                          textAlign: 'center', minWidth: '90px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%',
                              background: s.color, display: 'inline-block' }} />
                            {s.short_name ?? s.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map(cls => (
                      <tr key={cls.id}>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #d1d5db',
                          fontWeight: 500, color: 'var(--color-text-primary)', background: '#f9fafb',
                          position: 'sticky', left: 0 }}>
                          {cls.name}
                        </td>
                        {subjects.map(subj => {
                          const cell = matrix[cls.id]?.[subj.id]
                          const isActive = activeCell?.classId === cls.id && activeCell?.subjectId === subj.id
                          const missingTeacher = cell && cell.weekly_hours > 0 && !cell.teacher_id
                          return (
                            <td key={subj.id} style={{ padding: '4px', border: '0.5px solid #d1d5db',
                              textAlign: 'center', position: 'relative' }}>
                              <button
                                onClick={e => {
                                if (e.ctrlKey || e.metaKey) {
                                  // Ctrl+Click: toggle this cell in multi-select (same subject only)
                                  if (multiSubjectId && multiSubjectId !== subj.id) {
                                    // Different subject column — reset selection
                                    setSelectedCells(new Set([`${cls.id}|${subj.id}`]))
                                    setMultiSubjectId(subj.id)
                                  } else {
                                    const key = `${cls.id}|${subj.id}`
                                    setSelectedCells(prev => {
                                      const next = new Set(prev)
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                    setMultiSubjectId(subj.id)
                                  }
                                  setActiveCell(null)
                                } else {
                                  // Normal click: open single popover
                                  setSelectedCells(new Set())
                                  setMultiSubjectId(null)
                                  setActiveCell(isActive ? null : { classId: cls.id, subjectId: subj.id })
                                }
                              }}
                                style={{ width: '100%', minWidth: '80px', padding: '5px 4px',
                                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: cell ? subj.color + '22' : selectedCells.has(`${cls.id}|${subj.id}`) ? '#eff6ff' : 'transparent',
                                  outline: isActive ? `2px solid ${subj.color}` : selectedCells.has(`${cls.id}|${subj.id}`) ? '2px solid #2563eb' : missingTeacher ? '2px solid #fca5a5' : 'none' }}>
                                {cell ? (
                                  <div>
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                      {cell.weekly_hours}h
                                    </span>
                                    {cell.lesson_pattern && (
                                      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>
                                        [{cell.lesson_pattern.join(',')}]
                                      </span>
                                    )}
                                    {cell.teacher_id ? (
                                      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {teachers.find(t => t.id === cell.teacher_id)?.name}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10px', color: '#dc2626', display: 'block' }}>
                                        fără prof ⚠
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#d1d5db', fontSize: '16px' }}>+</span>
                                )}
                              </button>

                              {/* ── Cell popover ───────────────────────── */}
                              {isActive && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%',
                                  transform: 'translateX(-50%)', zIndex: 50, background: '#fff',
                                  border: '0.5px solid #d1d5db', borderRadius: '12px', padding: '14px',
                                  width: '220px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                                    {cls.name} · {subj.name}
                                  </p>

                                  <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Ore/săpt
                                    <input type="number" min={0} max={20}
                                      value={cell?.weekly_hours ?? 0}
                                      onChange={e => {
                                        const n = +e.target.value
                                        if (n === 0) setCell(cls.id, subj.id, null)
                                        else setCell(cls.id, subj.id, {
                                          weekly_hours:      n,
                                          lesson_pattern:    cell?.lesson_pattern ?? null,
                                          teacher_id:        cell?.teacher_id ?? '',
                                          preferred_room_id: cell?.preferred_room_id ?? null,
                                        })
                                      }}
                                      style={{ ...inp, marginTop: '3px' }} />
                                  </label>

                                  {cell && (
                                    <>
                                      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                        Pattern ore (ex: 2,1 pentru bloc dublu)
                                        <input
                                          placeholder={`implicit: ${Array(cell.weekly_hours).fill(1).join(',')}`}
                                          value={cell.lesson_pattern?.join(',') ?? ''}
                                          onChange={e => {
                                            const raw = e.target.value
                                            const pattern = raw ? raw.split(',').map(Number).filter(n => n > 0) : null
                                            setCell(cls.id, subj.id, { ...cell, lesson_pattern: pattern })
                                          }}
                                          style={{ ...inp, marginTop: '3px' }} />
                                      </label>

                                      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                        Profesor <span style={{ color: '#dc2626' }}>*</span>
                                        <select
                                          value={cell.teacher_id ?? ''}
                                          onChange={e => setCell(cls.id, subj.id, { ...cell, teacher_id: e.target.value })}
                                          style={{ ...inp, marginTop: '3px',
                                            borderColor: !cell.teacher_id ? '#fca5a5' : '#d1d5db' }}>
                                          <option value="">— selectează —</option>
                                          {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                          ))}
                                        </select>
                                      </label>

                                      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '10px' }}>
                                        Sală preferată
                                        <select
                                          value={cell.preferred_room_id ?? ''}
                                          onChange={e => setCell(cls.id, subj.id, { ...cell, preferred_room_id: e.target.value || null })}
                                          style={{ ...inp, marginTop: '3px' }}>
                                          <option value="">— fără preferință —</option>
                                          {rooms
                                            .filter(r => !subj.required_room_type || r.type === subj.required_room_type)
                                            .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                      </label>
                                    </>
                                  )}

                                  <button onClick={() => { setCell(cls.id, subj.id, null); setActiveCell(null) }}
                                    style={{ fontSize: '11px', color: '#dc2626', background: 'none',
                                      border: 'none', cursor: 'pointer', padding: 0 }}>
                                    Șterge
                                  </button>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Constraints tab ────────────────────────────────────────────── */}
        {activeTab === 'constraints' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Hard rules — info only */}
            <div style={{ padding: '14px 16px', borderRadius: '12px',
              background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#059669', margin: '0 0 8px',
                display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} /> Constrângeri hard (întotdeauna active)
              </p>
              {[
                'Un profesor nu poate fi în două clase simultan',
                'O clasă nu poate avea două materii în același slot',
                'O sală nu poate fi ocupată de două clase simultan',
                'Ore duble plasate consecutive în aceeași zi',
                'Respectarea unavailable_slots per profesor',
                'Respectarea max_lessons_per_day/week per profesor',
                'Respectarea max_lessons_per_day per clasă',
                'Normă minimă (min_lessons_per_week) când e setată',
              ].map(r => (
                <p key={r} style={{ fontSize: '12px', color: 'var(--color-text-primary)', margin: '2px 0', paddingLeft: '6px' }}>
                  • {r}
                </p>
              ))}
            </div>

            {/* Soft rules — sliders */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0,
                  display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} style={{ color: '#d97706' }} /> Constrângeri soft (weight 0–100)
                </p>
                <button onClick={() => setSoftRules(DEFAULT_SOFT_RULES)}
                  style={{ fontSize: '11px', color: '#6b7280', background: 'none',
                    border: '0.5px solid #d1d5db', borderRadius: '6px',
                    padding: '3px 10px', cursor: 'pointer' }}>
                  Reset defaults
                </button>
              </div>

              {[
                {
                  key: 'teacherGaps' as const,
                  label: 'Ferestre minime profesori',
                  hint: 'Evită orele libere între lecțiile unui profesor',
                  toggle: 'avoidGapsForTeachers' as const,
                },
                {
                  key: 'lastHour' as const,
                  label: 'Clase mici nu la ultima oră',
                  hint: 'Primar și gimnaziu evită ultima oră din zi',
                  toggle: 'avoidLastHourForStages' as const,
                },
                {
                  key: 'sameSubject' as const,
                  label: 'Evită aceeași materie de două ori/zi',
                  hint: 'Max 1 oră din aceeași materie pe zi per clasă',
                  toggle: 'avoidSameSubjectTwicePerDay' as const,
                },
                {
                  key: 'hardMorning' as const,
                  label: 'Materii grele dimineața',
                  hint: 'Matematică, fizică etc. în primele sloturi',
                  toggle: 'hardSubjectsMorning' as const,
                },
                {
                  key: 'startFirst' as const,
                  label: 'Orele încep de la primul slot',
                  hint: 'Clase fără ferestre la începutul zilei',
                  toggle: 'startFromFirstSlot' as const,
                },
              ].map(({ key, label, hint, toggle }) => {
                const enabled = !!(softRules as any)[toggle]
                const weight  = softRules.weights[key]
                return (
                  <div key={key} style={{ marginBottom: '16px', padding: '12px 14px',
                    borderRadius: '10px', background: enabled ? '#f9fafb' : '#fafafa',
                    border: '0.5px solid #d1d5db', opacity: enabled ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={enabled}
                            onChange={e => updateSoftRule(toggle as any, e.target.checked)} />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</span>
                        </label>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', margin: '2px 0 0 22px' }}>{hint}</p>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', minWidth: '32px', textAlign: 'right' }}>
                        {weight}
                      </span>
                    </div>
                    <input type="range" min={0} max={100} value={weight} disabled={!enabled}
                      onChange={e => updateWeight(key, +e.target.value)}
                      style={{ width: '100%', accentColor: '#2563eb' }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Multi-edit panel (Ctrl+Click) ──────────────────────────────── */}
        {selectedCells.size > 0 && multiSubjectId && (() => {
          const subj = subjects.find(s => s.id === multiSubjectId)
          const selectedClassIds = [...selectedCells].map(k => k.split('|')[0])
          const cells = selectedClassIds.map(cid => matrix[cid]?.[multiSubjectId])
          const firstCell = cells.find(Boolean)
          return (
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '12px',
              background: '#eff6ff', border: '0.5px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-info)', margin: 0 }}>
                  Editare multiplă — {subj?.name} · {selectedCells.size} {selectedCells.size === 1 ? 'clasă' : 'clase'}:
                  {' '}<span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                    {selectedClassIds.map(cid => classes.find(c => c.id === cid)?.name).join(', ')}
                  </span>
                </p>
                <button onClick={() => { setSelectedCells(new Set()); setMultiSubjectId(null) }}
                  style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              <MultiEditForm
                firstCell={firstCell}
                teachers={teachers}
                onApply={(hours, pattern, teacherId) => {
                  selectedClassIds.forEach(cid => {
                    if (hours === 0) setCell(cid, multiSubjectId, null)
                    else setCell(cid, multiSubjectId, {
                      weekly_hours:      hours,
                      lesson_pattern:    pattern,
                      teacher_id:        teacherId,
                      preferred_room_id: matrix[cid]?.[multiSubjectId]?.preferred_room_id ?? null,
                    })
                  })
                  setSelectedCells(new Set())
                  setMultiSubjectId(null)
                }}
              />
            </div>
          )
        })()}

        {/* ── Fast-check result ───────────────────────────────────────────── */}
        {feasibility && (
          <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px',
            background: feasibility.ok ? '#f0fdf4' : '#fef2f2',
            border: `0.5px solid ${feasibility.ok ? '#bbf7d0' : '#fecaca'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, margin: 0,
                color: feasibility.ok ? '#059669' : '#dc2626',
                display: 'flex', alignItems: 'center', gap: '6px' }}>
                {feasibility.ok
                  ? <><CheckCircle size={14}/> Fast-check OK — se poate genera</>
                  : <><AlertTriangle size={14}/> {feasibility.errors.length} probleme detectate</>}
              </p>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {curriculumList.reduce((s, c) => s + c.weekly_hours, 0)} lecții totale · {daysPerWeek}z × {slots}sl = {daysPerWeek * slots} sloturi/profesor
              </span>
            </div>
            {feasibility.errors.map((e, i) => (
              <p key={i} style={{ fontSize: '12px', color: '#7f1d1d', margin: '2px 0', paddingLeft: '6px' }}>
                • <strong>{e.entity}</strong>: {e.detail}
              </p>
            ))}
          </div>
        )}

        {/* ── Footer buttons ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
          <button onClick={saveAll} disabled={saving}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '0.5px solid #d1d5db',
              background: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
            {saving ? '...' : 'Salvează'}
          </button>
          <button onClick={runCheck}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '0.5px solid #d97706',
              background: '#fffbeb', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#d97706' }}>
            Verifică
          </button>
          <button onClick={generate} disabled={generating || curriculumList.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
              borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              opacity: (generating || curriculumList.length === 0) ? 0.6 : 1 }}>
            {generating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px', animation: 'scratch 1.2s ease-in-out infinite' }}>🤔</span>
                Se gândește...
              </span>
            ) : (
              <><Zap size={14}/> Generează</>
            )}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            {curriculumList.length} asignări
          </span>
        </div>
      </div>

      {/* ── Right: Tips panel ─────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div style={{ padding: '16px', borderRadius: '12px', background: '#f8faff',
          border: '0.5px solid #e0e7ff', fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: '1.7' }}>
          <p style={{ fontWeight: 500, margin: '0 0 10px', color: '#4338ca', fontSize: '13px' }}>
            {activeTab === 'curriculum' ? 'Cum completezi curriculum' : 'Cum funcționează constrângerile'}
          </p>

          {activeTab === 'curriculum' ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Click pe celulă</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Setează ore/săpt, pattern și profesor. Celula goală = clasa nu studiază acea materie.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Pattern ore</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Ex: 5h cu pattern <code>2,1,1,1</code> = un bloc de 2h + 3 ore single. Implicit toate single.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Profesor <span style={{ color: '#dc2626' }}>*</span></p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Obligatoriu. Algoritmul garantează că nu e în două locuri simultan.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Verifică</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Butonul "Verifică" rulează fast-check instant — detectează probleme înainte de a trimite la solver.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Ctrl+Click</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Selectează mai multe clase din aceeași coloană pentru editare în bloc — ore, pattern și profesor simultan.</p>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#eff6ff' }}>
                <p style={{ margin: 0, color: 'var(--color-text-info)', fontSize: '11px' }}>
                  Indisponibilitățile profesorilor sunt setate în Resurse → Profesori.
                </p>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Hard constraints</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Întotdeauna respectate. Dacă nu pot fi satisfăcute simultan, solver-ul raportează INFEASIBLE cu motive clare.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Soft constraints</p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Solver-ul le minimizează în funcție de weight. Weight 0 = ignorat complet. Weight 100 = prioritate maximă.</p>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#eff6ff' }}>
                <p style={{ margin: 0, color: 'var(--color-text-info)', fontSize: '11px' }}>
                  Dacă solver-ul durează prea mult, reduce numărul de asignări sau scade weights la soft constraints.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      </div>{/* end 2-col grid */}

      <style>{`
        @keyframes scratch {
          0%,100% { transform: rotate(-8deg) translateY(0) }
          25%      { transform: rotate(12deg) translateY(-2px) }
          50%      { transform: rotate(-5deg) translateY(1px) }
          75%      { transform: rotate(10deg) translateY(-1px) }
        }
      `}</style>
    </div>
  )
}