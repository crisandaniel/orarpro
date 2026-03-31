'use client'

// SchoolSetupClient — orchestrator pentru configurare și generare orar școlar.
//
// Ține state-ul global și deleghează render-ul la subcomponente:
//   CurriculumMatrix   — tabelul clasă×materie
//   ConstraintsPanel   — hard/soft constraints cu slidere
//   MultiEditForm      — editare în bloc Ctrl+Click
//   SolverDebugLog     — sumar + detalii solver
//
// Used by: schedules/[id]/school-setup/page.tsx

import { useState, useMemo } from 'react'
import { Settings, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { TimetableGrid } from '@/components/schedule/TimetableGrid'
import { CurriculumMatrix } from './school-setup/CurriculumMatrix'
import { ConstraintsPanel }  from './school-setup/ConstraintsPanel'
import { MultiEditForm }     from './school-setup/MultiEditForm'
import { SolverDebugLog }    from './school-setup/SolverDebugLog'
import { runFeasibilityCheck } from './school-setup/feasibility'
import { DEFAULT_SOFT_RULES, inp } from './school-setup/types'
import type { CellData } from './school-setup/types'
import type {
  SchoolResources, CurriculumItem, ScheduleConfig,
  SoftRules, FeasibilityCheck,
} from '@/types'

interface Props {
  scheduleId:          string
  scheduleName:        string
  locale:              string
  resources:           SchoolResources
  existingConfig?:     ScheduleConfig | null
  existingCurriculum?: CurriculumItem[]
  existingLessons?:    any[]
  existingSolverUsed?: string
  daysPerWeek?:        number
  slotsPerDay?:        number
}

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
    return {
      ...DEFAULT_SOFT_RULES, ...saved,
      avoidLastHourForStages: Array.isArray(saved.avoidLastHourForStages)
        ? saved.avoidLastHourForStages
        : (saved.avoidLastHourForStages as any) === false
          ? false : ['primary', 'middle'] as any,
      weights: { ...DEFAULT_SOFT_RULES.weights, ...(saved.weights ?? {}) },
    } as SoftRules
  })

  // ── Curriculum matrix ─────────────────────────────────────────────────────
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
  const [activeCell,      setActiveCell]      = useState<{ classId: string; subjectId: string } | null>(null)
  const [selectedCells,   setSelectedCells]   = useState<Set<string>>(new Set())
  const [multiSubjectId,  setMultiSubjectId]  = useState<string | null>(null)
  const [activeTab,       setActiveTab]       = useState<'curriculum' | 'constraints'>('curriculum')
  const [showConfig,      setShowConfig]      = useState(!existingConfig)
  const [saving,          setSaving]          = useState(false)
  const [generating,      setGenerating]      = useState(false)
  const [generatedLessons,setGeneratedLessons]= useState<any[]>(existingLessons)
  const [solverUsed,      setSolverUsed]      = useState<string | undefined>(existingSolverUsed)
  const [solverInfo,      setSolverInfo]      = useState<{ cpsatReasons: string[] } | null>(null)
  const [debugLog,        setDebugLog]        = useState<any[]>([])
  const [feasibility,     setFeasibility]     = useState<FeasibilityCheck | null>(null)
  const [timetableKey,    setTimetableKey]    = useState(0)

  // ── Derived ───────────────────────────────────────────────────────────────
  const curriculumList = useMemo(() => {
    const list: Array<CellData & { class_id: string; subject_id: string }> = []
    for (const cls of classes)
      for (const subj of subjects) {
        const cell = matrix[cls.id]?.[subj.id]
        if (cell && cell.weekly_hours > 0 && cell.teacher_id)
          list.push({ ...cell, class_id: cls.id, subject_id: subj.id })
      }
    return list
  }, [matrix, classes, subjects])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setCell(classId: string, subjectId: string, data: CellData | null) {
    setMatrix(prev => {
      const next = { ...prev, [classId]: { ...prev[classId] } }
      if (data === null) delete next[classId][subjectId]
      else next[classId][subjectId] = data
      return next
    })
    setFeasibility(null)
  }

  function handleCellClick(e: React.MouseEvent, classId: string, subjectId: string) {
    if (e.ctrlKey || e.metaKey) {
      if (multiSubjectId && multiSubjectId !== subjectId) {
        setSelectedCells(new Set([`${classId}|${subjectId}`]))
        setMultiSubjectId(subjectId)
      } else {
        const key = `${classId}|${subjectId}`
        setSelectedCells(prev => {
          const next = new Set(prev)
          if (next.has(key)) next.delete(key); else next.add(key)
          return next
        })
        setMultiSubjectId(subjectId)
      }
      setActiveCell(null)
    } else {
      setSelectedCells(new Set())
      setMultiSubjectId(null)
      const isActive = activeCell?.classId === classId && activeCell?.subjectId === subjectId
      setActiveCell(isActive ? null : { classId, subjectId })
    }
  }

  function updateSoftRule(key: keyof Omit<SoftRules, 'weights'>, value: any) {
    if (key === 'avoidLastHourForStages') {
      setSoftRules(p => ({ ...p, [key]: value === true ? ['primary', 'middle'] : false }))
    } else {
      setSoftRules(p => ({ ...p, [key]: value }))
    }
  }

  function updateWeight(key: keyof SoftRules['weights'], value: number) {
    setSoftRules(p => ({ ...p, weights: { ...p.weights, [key]: value } }))
  }

  function slotLabel(period: number) {
    const [h, m] = firstSlot.split(':').map(Number)
    const from = h * 60 + m + period * (slotDuration + 10)
    const to   = from + slotDuration
    const fmt  = (n: number) =>
      `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
    return `${fmt(from)}–${fmt(to)}`
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveAll(): Promise<boolean> {
    const missing = classes.flatMap(cls =>
      subjects
        .filter(s => matrix[cls.id]?.[s.id]?.weekly_hours > 0 && !matrix[cls.id]?.[s.id]?.teacher_id)
        .map(s => `${cls.name} — ${s.name}`)
    )
    if (missing.length > 0) {
      toast.error(`Profesor lipsă: ${missing.slice(0,2).join(', ')}${missing.length > 2 ? ` +${missing.length-2}` : ''}`)
      return false
    }
    setSaving(true)
    const res = await fetch(`/api/schedules/${scheduleId}/school-setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { days, slots, slotDuration, firstSlot, softRules }, curriculum: curriculumList }),
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
    const check = runCheck()
    if (!check.ok) { toast.error(`Fast-check: ${check.errors.length} probleme detectate`); return }
    if (!await saveAll()) return
    setGenerating(true)
    try {
      const res    = await fetch(`/api/schedules/${scheduleId}/generate-school`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) {
        setSolverInfo({ cpsatReasons: (result.violations ?? []).map((v: any) => v.message) })
        toast.error('Orar imposibil de generat')
        return
      }
      setSolverUsed(result.solver)
      setDebugLog(result.debug_log ?? [])
      setSolverInfo(null)
      toast.success(`${result.stats?.scheduled_lessons ?? 0} ore generate`)
      const lr = await fetch(`/api/schedules/${scheduleId}/lessons`)
      if (lr.ok) {
        const { lessons } = await lr.json()
        console.log(`[generate] Loaded ${lessons?.length ?? 0} lessons`)
        setGeneratedLessons(lessons ?? [])
        setTimetableKey(k => k + 1)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      } else {
        toast.error('Eroare la încărcarea orarului')
      }
    } catch { toast.error('Eroare la generare') }
    finally  { setGenerating(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>{scheduleName}</h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Configurează curriculum și generează orarul</p>
      </div>

      {/* Timetable */}
      {generatedLessons.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#111827', margin: 0 }}>Orar generat</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                {generatedLessons.length} ore
                {solverUsed && (
                  <span style={{ marginLeft: '8px', fontWeight: 500, padding: '1px 8px',
                    borderRadius: '20px', background: '#f0fdf4', color: '#059669', border: '0.5px solid #bbf7d0' }}>
                    ✓ CP-SAT
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => setGeneratedLessons([])}
              style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ascunde
            </button>
          </div>
          <TimetableGrid
            key={timetableKey}
            lessons={generatedLessons as any}
            teachers={teachers as any} subjects={subjects as any}
            classes={classes as any}  rooms={rooms as any}
            periodsPerDay={slots} periodDuration={slotDuration}
            firstPeriodStart={firstSlot}
            workingDays={Array.from({ length: days }, (_, i) => i)}
            scheduleId={scheduleId} locale={locale}
          />
        </div>
      )}

      {/* Solver errors */}
      {solverInfo && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px',
          background: '#fef2f2', border: '0.5px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#dc2626', margin: '0 0 8px' }}>
                Găsirea soluției optime a eșuat din următoarele motive:
              </p>
              {solverInfo.cpsatReasons.map((r, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#7f1d1d', margin: '2px 0', paddingLeft: '8px' }}>• {r}</p>
              ))}
            </div>
            <button onClick={() => setSolverInfo(null)}
              style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '12px' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Debug log */}
      <SolverDebugLog debugLog={debugLog} teachers={teachers} subjects={subjects} classes={classes} />

      {/* Setup — 2 col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>
      <div>

        {/* Config grid (collapsible) */}
        <div style={{ marginBottom: '16px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>
          <button onClick={() => setShowConfig(p => !p)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', background: '#f9fafb', border: 'none', cursor: 'pointer' }}>
            <Settings style={{ width: '16px', height: '16px', color: '#6b7280' }} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827', flex: 1, textAlign: 'left' }}>
              Configurare grilă
            </span>
            {showConfig ? <ChevronUp style={{ width: '14px', color: '#9ca3af' }} />
                        : <ChevronDown style={{ width: '14px', color: '#9ca3af' }} />}
          </button>
          {showConfig && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {[
                  { label: 'Zile/săpt',                         value: days,         set: setDays,                                         type: 'number', min: 1,  max: 7 },
                  { label: `Sloturi/zi (max ${slotsPerDay})`,   value: slots,        set: (v: number) => setSlots(Math.min(v, slotsPerDay)), type: 'number', min: 1,  max: slotsPerDay },
                  { label: 'Durată (min)',                       value: slotDuration, set: setSlotDuration,                                 type: 'number', min: 30, max: 120 },
                  { label: 'Prima oră',                          value: firstSlot,    set: setFirstSlot,                                    type: 'time' },
                ].map(({ label, value, set, type, min, max }: any) => (
                  <label key={label} style={{ fontSize: '12px', color: '#6b7280' }}>
                    {label}
                    <input type={type} min={min} max={max} value={value}
                      onChange={e => set(type === 'number' ? +e.target.value : e.target.value)}
                      style={{ ...inp, marginTop: '4px' }} />
                  </label>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>PREVIEW</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Array.from({ length: Math.min(slots, 12) }, (_, i) => (
                  <span key={i} style={{ fontSize: '11px', color: '#374151', background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px' }}>
                    S{i+1}: {slotLabel(i)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
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

        {activeTab === 'curriculum' && (
          <CurriculumMatrix
            classes={classes} subjects={subjects} teachers={teachers} rooms={rooms}
            matrix={matrix} activeCell={activeCell}
            selectedCells={selectedCells} multiSubjectId={multiSubjectId}
            onCellClick={handleCellClick}
            onSetCell={setCell}
            onClosePopover={() => setActiveCell(null)}
          />
        )}

        {activeTab === 'constraints' && (
          <ConstraintsPanel
            softRules={softRules}
            onUpdateRule={updateSoftRule}
            onUpdateWeight={updateWeight}
            onReset={() => setSoftRules(DEFAULT_SOFT_RULES)}
          />
        )}

        {/* Multi-edit */}
        {selectedCells.size > 0 && multiSubjectId && (() => {
          const subj = subjects.find(s => s.id === multiSubjectId)
          const selectedClassIds = [...selectedCells].map(k => k.split('|')[0])
          const firstCell = selectedClassIds.map(cid => matrix[cid]?.[multiSubjectId]).find(Boolean)
          return (
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '12px',
              background: '#eff6ff', border: '0.5px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#1d4ed8', margin: 0 }}>
                  Editare multiplă — {subj?.name} · {selectedCells.size} {selectedCells.size === 1 ? 'clasă' : 'clase'}:
                  {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>
                    {selectedClassIds.map(cid => classes.find(c => c.id === cid)?.name).join(', ')}
                  </span>
                </p>
                <button onClick={() => { setSelectedCells(new Set()); setMultiSubjectId(null) }}
                  style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              <MultiEditForm firstCell={firstCell} teachers={teachers}
                onApply={(hours, pattern, teacherId) => {
                  selectedClassIds.forEach(cid => {
                    if (hours === 0) setCell(cid, multiSubjectId, null)
                    else setCell(cid, multiSubjectId, {
                      weekly_hours: hours, lesson_pattern: pattern, teacher_id: teacherId,
                      preferred_room_id: matrix[cid]?.[multiSubjectId]?.preferred_room_id ?? null,
                    })
                  })
                  setSelectedCells(new Set()); setMultiSubjectId(null)
                }} />
            </div>
          )
        })()}

        {/* Fast-check result */}
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
                {curriculumList.reduce((s, c) => s + c.weekly_hours, 0)} lecții · {daysPerWeek}z × {slots}sl = {daysPerWeek * slots} sloturi/prof
              </span>
            </div>
            {feasibility.errors.map((e, i) => (
              <p key={i} style={{ fontSize: '12px', color: '#7f1d1d', margin: '2px 0', paddingLeft: '6px' }}>
                • <strong>{e.entity}</strong>: {e.detail}
              </p>
            ))}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
          <button onClick={saveAll} disabled={saving}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '0.5px solid #d1d5db',
              background: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
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
            ) : <><Zap size={14}/> Generează</>}
          </button>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{curriculumList.length} asignări</span>
        </div>
      </div>

      {/* Tips panel */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div style={{ padding: '16px', borderRadius: '12px', background: '#f8faff',
          border: '0.5px solid #e0e7ff', fontSize: '12px', color: '#374151', lineHeight: '1.7' }}>
          <p style={{ fontWeight: 500, margin: '0 0 10px', color: '#4338ca', fontSize: '13px' }}>
            {activeTab === 'curriculum' ? 'Cum completezi curriculum' : 'Cum funcționează constrângerile'}
          </p>
          {activeTab === 'curriculum' ? (
            <>
              {[
                ['Click pe celulă', 'Setează ore/săpt, pattern și profesor. Celula goală = clasa nu studiază acea materie.'],
                ['Pattern ore', 'Ex: 5h cu pattern 2,1,1,1 = un bloc de 2h + 3 ore single. Implicit toate single.'],
                ['Profesor *', 'Obligatoriu. Algoritmul garantează că nu e în două locuri simultan.'],
                ['Verifică', 'Rulează fast-check instant — detectează probleme înainte de solver.'],
                ['Ctrl+Click', 'Selectează mai multe clase din aceeași coloană pentru editare în bloc.'],
              ].map(([title, desc]) => (
                <div key={title} style={{ marginBottom: '10px' }}>
                  <p style={{ fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>{title}</p>
                  <p style={{ margin: 0, color: '#6b7280' }}>{desc}</p>
                </div>
              ))}
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#eff6ff' }}>
                <p style={{ margin: 0, color: '#1d4ed8', fontSize: '11px' }}>
                  Indisponibilitățile profesorilor se setează în Resurse → Profesori.
                </p>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Hard constraints</p>
                <p style={{ margin: 0, color: '#6b7280' }}>Întotdeauna respectate. Dacă nu pot fi satisfăcute, solver-ul raportează INFEASIBLE cu motive clare.</p>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Soft constraints</p>
                <p style={{ margin: 0, color: '#6b7280' }}>Minimizate în funcție de weight. Weight 0 = ignorat. Weight 100 = prioritate maximă.</p>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#eff6ff' }}>
                <p style={{ margin: 0, color: '#1d4ed8', fontSize: '11px' }}>
                  Dacă solver-ul durează prea mult, scade weights la soft constraints.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      </div>

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
