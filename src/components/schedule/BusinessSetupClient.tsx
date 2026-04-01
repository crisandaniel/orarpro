'use client'

// BusinessSetupClient — orchestrator pentru configurare și generare orar business.
//
// Pattern identic cu SchoolSetupClient:
//   - Primește initialAssignments din page.tsx (asignările existente)
//   - Afișează ScheduleGrid deasupra dacă există asignări
//   - SolverDebugLog după generare
//   - Config grilă colapsibil
//   - Tab Ture | Tab Constrângeri
//   - Statistici ture (echivalent statistici profesori)
//   - Fast-check result inline
//   - 3 butoane: Salvează | Verifică | Generează
//   - Tips panel sticky dreapta
//
// Used by: schedules/[id]/business-setup/page.tsx

import { useState, useMemo } from 'react'
import { Settings, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { EmployeeStats } from '@/components/schedule/EmployeeStats'
import { BusinessConstraintsPanel } from './business-setup/ConstraintsPanel'
import { BusinessSolverDebugLog }   from './business-setup/SolverDebugLog'
import { runBusinessFeasibilityCheck } from './business-setup/feasibility'
import { DEFAULT_BUSINESS_SOFT_RULES, inp } from './business-setup/types'
import type { BusinessSoftRules } from './business-setup/types'
import type { Employee, Schedule, ShiftDefinition } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom'

interface ShiftDraft {
  localId:          string
  name:             string
  shift_type:       ShiftType
  start_time:       string
  end_time:         string
  crosses_midnight: boolean
  color:            string
  slots_per_day:    number
}

interface HardConfig {
  min_employees_per_shift:   number
  max_consecutive_days:      number
  min_rest_hours:            number
  max_weekly_hours:          number
  max_night_shifts_per_week: number
  enforce_legal_limits:      boolean
}

interface Props {
  schedule:           Schedule
  employees:          Employee[]
  shiftDefs:          ShiftDefinition[]   // ture existente din schedule_shifts
  initialAssignments: any[]               // asignări existente cu joins (ca la school existingLessons)
  locale:             string
  holidays?:           any[]
  existingGenerationConfig?: any
}

const SHIFT_COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: 'morning',   label: 'Dimineață' },
  { value: 'afternoon', label: 'Amiază' },
  { value: 'night',     label: 'Noapte' },
  { value: 'custom',    label: 'Custom' },
]

const DEFAULT_HARD: HardConfig = {
  min_employees_per_shift: 2, max_consecutive_days: 6,
  min_rest_hours: 11, max_weekly_hours: 48,
  max_night_shifts_per_week: 2, enforce_legal_limits: true,
}

const DEFAULT_SHIFTS: ShiftDraft[] = [{
  localId: 'draft-1', name: 'Dimineață', shift_type: 'morning',
  start_time: '06:00', end_time: '14:00', crosses_midnight: false,
  color: '#10b981', slots_per_day: 2,
}]

let draftCounter = 100

// ── Component ─────────────────────────────────────────────────────────────────

export function BusinessSetupClient({
  schedule, employees, shiftDefs: initialShiftDefs,
  initialAssignments, locale, holidays = [], existingGenerationConfig
}: Props) {

  // DEBUG
  console.log('[BSC] props — shiftDefs:', initialShiftDefs.length, initialShiftDefs.map((s:any) => s?.name))
  console.log('[BSC] props — initialAssignments:', initialAssignments.length)

  // ── Shifts state — populat din shiftDefs existente (ca la school existingCurriculum) ──
  const [shifts, setShifts] = useState<ShiftDraft[]>(() =>
    initialShiftDefs.length > 0
      ? initialShiftDefs.map((s, i) => ({
          localId:          `existing-${i}`,
          name:             s.name,
          shift_type:       (s as any).shift_type ?? 'custom',
          start_time:       (s as any).start_time ?? '08:00',
          end_time:         (s as any).end_time ?? '16:00',
          crosses_midnight: (s as any).crosses_midnight ?? false,
          color:            (s as any).color ?? SHIFT_COLORS[i % SHIFT_COLORS.length],
          slots_per_day:    (s as any).slots_per_day ?? 1,
        }))
      : DEFAULT_SHIFTS
  )
  const [shiftsSaved,  setShiftsSaved]  = useState(initialShiftDefs.length > 0)
  const [saving,       setSaving]       = useState(false)
  const [hardConfig,   setHardConfig]   = useState<HardConfig>(DEFAULT_HARD)
  const [softRules,    setSoftRules]    = useState<BusinessSoftRules>(DEFAULT_BUSINESS_SOFT_RULES)
  const [activeTab,    setActiveTab]    = useState<'shifts' | 'constraints'>('shifts')
  const [showConfig,   setShowConfig]   = useState(!initialShiftDefs.length)
  const [generating,   setGenerating]   = useState(false)
  const [solverInfo,   setSolverInfo]   = useState<{ reasons: string[] } | null>(null)
  const [debugLog,     setDebugLog]     = useState<any[]>([])
  const [feasibility,  setFeasibility]  = useState<ReturnType<typeof runBusinessFeasibilityCheck> | null>(null)

  // Asignări afișate — pornesc din initialAssignments (ca la school generatedLessons = existingLessons)
  const [assignments,   setAssignments]  = useState<any[]>(initialAssignments)
  const [assignedDefs,  setAssignedDefs] = useState<ShiftDefinition[]>(initialShiftDefs)
  const [gridKey,       setGridKey]      = useState(0)

  const activeEmployees  = useMemo(() => employees.filter(e => e.is_active), [employees])
  const totalSlotsPerDay = useMemo(() => shifts.reduce((s, sh) => s + sh.slots_per_day, 0), [shifts])

  // ── Shift CRUD ────────────────────────────────────────────────────────────

  function addShift() {
    draftCounter++
    setShifts(prev => [...prev, {
      localId: `draft-${draftCounter}`, name: '', shift_type: 'custom',
      start_time: '08:00', end_time: '16:00', crosses_midnight: false,
      color: SHIFT_COLORS[prev.length % SHIFT_COLORS.length], slots_per_day: 2,
    }])
    setShiftsSaved(false)
  }

  function removeShift(localId: string) {
    if (shifts.length <= 1) { toast.error('Trebuie cel puțin o tură.'); return }
    setShifts(prev => prev.filter(s => s.localId !== localId))
    setShiftsSaved(false)
  }

  function updateShift(localId: string, key: keyof ShiftDraft, value: any) {
    setShifts(prev => prev.map(s => s.localId === localId ? { ...s, [key]: value } : s))
    setShiftsSaved(false)
  }

  function updateHard<K extends keyof HardConfig>(key: K, value: HardConfig[K]) {
    setHardConfig(prev => ({ ...prev, [key]: value }))
  }

  // ── Save — identic cu school saveAll() ────────────────────────────────────

  async function saveAll(): Promise<boolean> {
    for (const s of shifts) {
      if (!s.name.trim()) { toast.error('Toate turele trebuie să aibă un nume.'); return false }
    }
    setSaving(true)
    const res = await fetch(`/api/schedules/${schedule.id}/setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shifts: shifts.map(s => ({
          name: s.name, shift_type: s.shift_type,
          start_time: s.start_time, end_time: s.end_time,
          crosses_midnight: s.crosses_midnight, color: s.color,
          slots_per_day: s.slots_per_day,
        })),
        generationConfig: {
          min_employees_per_shift:       hardConfig.min_employees_per_shift,
          max_consecutive_days:          hardConfig.max_consecutive_days,
          min_rest_hours:                hardConfig.min_rest_hours,
          max_weekly_hours:              hardConfig.max_weekly_hours,
          max_night_shifts_per_week:     hardConfig.max_night_shifts_per_week,
          enforce_legal_limits:          hardConfig.enforce_legal_limits,
          balance_shift_distribution:    softRules.balanceHours,
        },
      }),
    })
    setSaving(false)
    if (!res.ok) { const r = await res.json(); toast.error(r.error ?? 'Eroare la salvare'); return false }
    setShiftsSaved(true)
    toast.success('Salvat')
    return true
  }

  // ── Verifică — identic cu school runCheck() ───────────────────────────────

  function runCheck() {
    const slotsPerDay: Record<string, number> = {}
    shifts.forEach(s => { slotsPerDay[s.localId] = s.slots_per_day })
    const result = runBusinessFeasibilityCheck({
      employees,
      shiftDefs: shifts.map(s => ({
        id: s.localId, name: s.name,
        start_time: s.start_time, end_time: s.end_time,
        crosses_midnight: s.crosses_midnight,
      }) as any),
      slotsPerDay,
      daysPerWeek:       (schedule as any).working_days?.length ?? 5,
      maxConsecutiveDays: hardConfig.enforce_legal_limits ? 6  : hardConfig.max_consecutive_days,
      maxWeeklyHours:     hardConfig.enforce_legal_limits ? 48 : hardConfig.max_weekly_hours,
      minRestHours:       hardConfig.enforce_legal_limits ? 11 : hardConfig.min_rest_hours,
    })
    setFeasibility(result)
    return result
  }

  // ── Generate — identic cu school generate() ───────────────────────────────
  // După generare, fetch asignări cu joins din același endpoint ca page.tsx
  // (nu workaround — același query ca getScheduleWithData)

  async function generate() {
    const check = runCheck()
    if (!check.ok) { toast.error(`Fast-check: ${check.issues.filter(i => i.type === 'error').length} erori`); return }
    if (!await saveAll()) return
    setGenerating(true)
    try {
      const res    = await fetch(`/api/schedules/${schedule.id}/generate-business`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hard_config: hardConfig, soft_rules: softRules }),
      })
      const result = await res.json()

      if (!res.ok) {
        setSolverInfo({ reasons: (result.violations ?? []).map((v: any) => v.message) })
        setDebugLog(result.debug_log ?? [])
        toast.error('Orar imposibil de generat')
        return
      }

      setDebugLog(result.debug_log ?? [])
      setSolverInfo(null)
      toast.success(`${result.stats?.filled_slots ?? 0} ture generate`)

      // Route returnează assignments cu joins direct în răspuns — fără fetch extra
      if (result.assignments?.length) {
        setAssignments(result.assignments)
        setAssignedDefs(result.shiftDefs ?? [])
        setGridKey(k => k + 1)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      }
    } catch { toast.error('Eroare de rețea') }
    finally  { setGenerating(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header — identic cu school */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>
          {schedule.name}
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
          Configurează turele și generează orarul
        </p>
      </div>

      {/* Orar generat — identic cu school: ScheduleGrid în loc de TimetableGrid */}
      {assignments.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#111827', margin: 0 }}>Orar generat</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                {assignments.length} asignări
                <span style={{ marginLeft: '8px', fontWeight: 500, padding: '1px 8px',
                  borderRadius: '20px', background: '#f0fdf4', color: '#059669', border: '0.5px solid #bbf7d0' }}>
                  ✓ CP-SAT
                </span>
              </p>
            </div>
            <button
              onClick={() => setAssignments([])}
              style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Ascunde
            </button>
          </div>
          <ScheduleGrid
            key={gridKey}
            schedule={schedule as any}
            assignments={assignments}
            employees={employees as any}
            shiftDefinitions={assignedDefs as any}
            holidays={[]}
            scheduleId={schedule.id}
          />
          <EmployeeStats
            employees={employees as any}
            assignments={assignments as any}
            shiftDefinitions={assignedDefs as any}
            schedule={schedule as any}
          />
        </div>
      )}

      {/* Solver errors — identic cu school solverInfo */}
      {solverInfo && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px',
          background: '#fef2f2', border: '0.5px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#dc2626', margin: '0 0 8px' }}>
                Generarea a eșuat din următoarele motive:
              </p>
              {solverInfo.reasons.map((r, i) => (
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

      {/* Debug log — identic cu school */}
      <BusinessSolverDebugLog
        debugLog={debugLog}
        employees={employees}
        shiftDefs={shifts.map(s => ({ id: s.localId, name: s.name, color: s.color }))}
      />

      {/* Setup — 2 col, identic cu school */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>

          {/* Config grilă colapsibil — identic cu school */}
          <div style={{ marginBottom: '16px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>
            <button onClick={() => setShowConfig(p => !p)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '14px 16px', background: '#f9fafb', border: 'none', cursor: 'pointer' }}>
              <Settings style={{ width: '16px', height: '16px', color: '#6b7280' }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827', flex: 1, textAlign: 'left' }}>
                Configurare grilă
              </span>
              {showConfig
                ? <ChevronUp  style={{ width: '14px', color: '#9ca3af' }} />
                : <ChevronDown style={{ width: '14px', color: '#9ca3af' }} />}
            </button>

            {showConfig && (
              <div style={{ padding: '16px' }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                  background: '#eff6ff', border: '0.5px solid #bfdbfe', marginBottom: '14px',
                }}>
                  <input
                    type="checkbox" checked={hardConfig.enforce_legal_limits}
                    onChange={e => updateHard('enforce_legal_limits', e.target.checked)}
                    style={{ marginTop: '2px', accentColor: '#2563eb' }}
                  />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#1d4ed8', margin: '0 0 2px' }}>
                      Aplică limite legale UE
                    </p>
                    <p style={{ fontSize: '11px', color: '#3b82f6', margin: 0 }}>
                      Min 11h repaus · max 48h/săpt · max 6 zile consecutive
                    </p>
                  </div>
                </label>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px',
                  opacity: hardConfig.enforce_legal_limits ? 0.45 : 1,
                  pointerEvents: hardConfig.enforce_legal_limits ? 'none' : 'auto',
                }}>
                  {([
                    { key: 'max_consecutive_days'     as const, label: 'Max zile consecutive',  min: 1, max: 7  },
                    { key: 'min_rest_hours'            as const, label: 'Repaus minim (ore)',     min: 0, max: 24 },
                    { key: 'max_weekly_hours'          as const, label: 'Max ore/săpt',           min: 1, max: 80 },
                    { key: 'max_night_shifts_per_week' as const, label: 'Max ture noapte/săpt',  min: 0, max: 7  },
                  ] as const).map(({ key, label, min, max }) => (
                    <label key={key} style={{ fontSize: '12px', color: '#6b7280' }}>
                      {label}
                      <input type="number" min={min} max={max}
                        value={hardConfig[key] as number}
                        onChange={e => updateHard(key, Number(e.target.value))}
                        style={{ ...inp, marginTop: '4px' }} />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs — identic cu school */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', marginBottom: '16px' }}>
            {(['shifts', 'constraints'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 500, marginBottom: '-1px',
                  borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                  color: activeTab === tab ? '#1d4ed8' : '#6b7280',
                }}>
                {tab === 'shifts' ? `Ture (${shifts.length})` : 'Constrângeri'}
              </button>
            ))}
          </div>

          {/* Tab: Ture */}
          {activeTab === 'shifts' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {shifts.map(shift => (
                  <ShiftCard key={shift.localId} shift={shift} canDelete={shifts.length > 1}
                    onUpdate={(k, v) => updateShift(shift.localId, k, v)}
                    onRemove={() => removeShift(shift.localId)} />
                ))}
              </div>

              <button onClick={addShift} style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                border: '2px dashed #e5e7eb', background: 'transparent',
                color: '#9ca3af', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                marginBottom: '16px',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.color = '#2563eb' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af' }}>
                + Adaugă tură
              </button>

              {/* Statistici ture — identic cu statisticile profesori din school */}
              {shifts.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#374151', margin: 0 }}>
                      Distribuție sloturi/zi
                    </p>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      Total: {totalSlotsPerDay} ang/zi · {activeEmployees.length} activi
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {shifts.map(s => {
                      const pct = Math.round((s.slots_per_day / Math.max(totalSlotsPerDay, 1)) * 100)
                      const ok  = activeEmployees.length >= s.slots_per_day
                      return (
                        <div key={s.localId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#111827', flex: 1 }}>{s.name || '(fără nume)'}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: ok ? '#374151' : '#dc2626' }}>
                              {s.slots_per_day} ang/zi{!ok && ' ⚠'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '80px', textAlign: 'right' }}>
                              {s.start_time}–{s.end_time}
                            </span>
                          </div>
                          <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '2px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab: Constrângeri — identic cu school */}
          {activeTab === 'constraints' && (
            <BusinessConstraintsPanel
              softRules={softRules}
              onUpdateRule={(key, val) => setSoftRules(p => ({ ...p, [key]: val }))}
              onUpdateWeight={(key, val) => setSoftRules(p => ({ ...p, weights: { ...p.weights, [key]: val } }))}
              onReset={() => setSoftRules(DEFAULT_BUSINESS_SOFT_RULES)}
            />
          )}

          {/* Fast-check result — identic cu school */}
          {feasibility && (
            <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px',
              background: feasibility.ok ? '#f0fdf4' : '#fef2f2',
              border: `0.5px solid ${feasibility.ok ? '#bbf7d0' : '#fecaca'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, margin: 0,
                  color: feasibility.ok ? '#059669' : '#dc2626',
                  display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {feasibility.ok
                    ? <><CheckCircle size={14} /> Fast-check OK — se poate genera</>
                    : <><AlertTriangle size={14} /> {feasibility.issues.filter(i => i.type === 'error').length} probleme detectate</>}
                </p>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {activeEmployees.length} angajați · {totalSlotsPerDay} slots/zi
                </span>
              </div>
              {feasibility.issues.map((issue, i) => (
                <p key={i} style={{ fontSize: '12px', margin: '2px 0', paddingLeft: '6px',
                  color: issue.type === 'error' ? '#7f1d1d' : '#92400e' }}>
                  • {issue.message}
                </p>
              ))}
            </div>
          )}

          {/* Footer buttons — identic cu school: Salvează | Verifică | Generează */}
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

            <button onClick={generate} disabled={generating || shifts.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
                borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                opacity: (generating || shifts.length === 0) ? 0.6 : 1 }}>
              {generating
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px', animation: 'scratch 1.2s ease-in-out infinite' }}>🤔</span>
                    Se gândește...
                  </span>
                : <><Zap size={14} /> Generează</>}
            </button>

            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              {shifts.length} ture · {shiftsSaved ? '✓ salvat' : '⚠ nesalvat'}
            </span>
          </div>
        </div>

        {/* Tips panel sticky — identic cu school */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: '#f8faff',
            border: '0.5px solid #e0e7ff', fontSize: '12px', color: '#374151', lineHeight: '1.7' }}>
            <p style={{ fontWeight: 500, margin: '0 0 10px', color: '#4338ca', fontSize: '13px' }}>
              {activeTab === 'shifts' ? 'Cum configurezi turele' : 'Cum funcționează constrângerile'}
            </p>
            {activeTab === 'shifts' ? (
              <>
                {[
                  ['Definire tură',       'Setează orele de start/end, tipul și câți angajați sunt necesari simultan pe zi.'],
                  ['Angajați/zi',         'Numărul minim necesar în tură. Dacă nu sunt suficienți, se raportează tură neacoperită.'],
                  ['Trece miezul nopții', 'Bifează pentru ture ca 22:00–06:00. Repausul se calculează automat.'],
                  ['Salvează',            'Obligatoriu înainte de generare. Salvează turele și limitele în DB.'],
                  ['Verifică',            'Fast-check instant — detectează probleme fără a apela solver-ul.'],
                ].map(([title, desc]) => (
                  <div key={title} style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>{title}</p>
                    <p style={{ margin: 0, color: '#6b7280' }}>{desc}</p>
                  </div>
                ))}
                <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#eff6ff' }}>
                  <p style={{ margin: 0, color: '#1d4ed8', fontSize: '11px' }}>
                    Indisponibilitățile angajaților se setează în secțiunea Angajați.
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

// ── ShiftCard ─────────────────────────────────────────────────────────────────

function ShiftCard({ shift, canDelete, onUpdate, onRemove }: {
  shift: ShiftDraft; canDelete: boolean
  onUpdate: (k: keyof ShiftDraft, v: any) => void
  onRemove: () => void
}) {
  const SHIFT_TYPES_LOCAL: { value: string; label: string }[] = [
    { value: 'morning',   label: 'Dimineață' },
    { value: 'afternoon', label: 'Amiază' },
    { value: 'night',     label: 'Noapte' },
    { value: 'custom',    label: 'Custom' },
  ]

  return (
    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fff', border: '0.5px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {SHIFT_COLORS.map(c => (
            <button key={c} onClick={() => onUpdate('color', c)} style={{
              width: '18px', height: '18px', borderRadius: '50%', background: c,
              border: 'none', cursor: 'pointer',
              outline: shift.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px',
              transform: shift.color === c ? 'scale(1.2)' : 'scale(1)',
            }} />
          ))}
        </div>
        {canDelete && (
          <button onClick={onRemove}
            style={{ marginLeft: 'auto', padding: '4px', borderRadius: '6px',
              background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', color: '#6b7280' }}>
          Nume
          <input value={shift.name} onChange={e => onUpdate('name', e.target.value)}
            placeholder="ex: Dimineață" style={{ ...inp, marginTop: '4px' }} />
        </label>
        <label style={{ fontSize: '12px', color: '#6b7280' }}>
          Tip
          <select value={shift.shift_type} onChange={e => onUpdate('shift_type', e.target.value)}
            style={{ ...inp, marginTop: '4px', cursor: 'pointer' }}>
            {SHIFT_TYPES_LOCAL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '12px', color: '#6b7280' }}>
          Angajați/zi
          <input type="number" min={1} max={50} value={shift.slots_per_day}
            onChange={e => onUpdate('slots_per_day', Math.max(1, Number(e.target.value)))}
            style={{ ...inp, marginTop: '4px', textAlign: 'center' }} />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <label style={{ flex: 1, fontSize: '12px', color: '#6b7280' }}>
          Ora start
          <input type="time" value={shift.start_time}
            onChange={e => onUpdate('start_time', e.target.value)}
            style={{ ...inp, marginTop: '4px' }} />
        </label>
        <label style={{ flex: 1, fontSize: '12px', color: '#6b7280' }}>
          Ora sfârșit
          <input type="time" value={shift.end_time}
            onChange={e => onUpdate('end_time', e.target.value)}
            style={{ ...inp, marginTop: '4px' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
          color: '#6b7280', cursor: 'pointer', paddingBottom: '8px', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={shift.crosses_midnight}
            onChange={e => onUpdate('crosses_midnight', e.target.checked)}
            style={{ accentColor: '#2563eb' }} />
          Trece miezul nopții
        </label>
      </div>
    </div>
  )
}