'use client'

// SchoolSetupClient — school timetable configuration wizard.
// Uses resources already defined in /resources (no re-definition needed).
// Sections: Config generală → Asignări → Generează
// Server passes: resources (teachers/subjects/classes/rooms), existingConfig, existingAssignments.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Settings, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import type { SchoolResources, LessonType } from '@/types'

interface Props {
  scheduleId: string
  scheduleName: string
  locale: string
  resources: SchoolResources
  existingConfig: any
  existingAssignments: any[]
}

interface ClassConfig {
  class_id: string
  periods_per_week: number
  requires_consecutive: boolean
}

interface AssignmentDraft {
  teacher_id: string
  subject_id: string
  class_configs: ClassConfig[]   // per-class config
  group_id: string | null
  lesson_type: LessonType
}

const DAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
const inp: React.CSSProperties = { border: '0.5px solid #d1d5db', color: '#111827', background: '#fff', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer', appearance: 'auto' as const }

function Section({ icon: Icon, title, subtitle, open, onToggle, children, badge }: any) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: '18px', height: '18px', color: '#2563eb' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{title}</span>
            {badge > 0 && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb' }}>{badge}</span>}
          </div>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{subtitle}</span>
        </div>
        {open ? <ChevronUp style={{ width: '16px', color: '#9ca3af' }} /> : <ChevronDown style={{ width: '16px', color: '#9ca3af' }} />}
      </div>
      {open && <div style={{ borderTop: '0.5px solid #f3f4f6', padding: '20px' }}>{children}</div>}
    </div>
  )
}

export function SchoolSetupClient({ scheduleId, scheduleName, locale, resources, existingConfig, existingAssignments }: Props) {
  const router = useRouter()
  const { teachers, subjects, classes, rooms } = resources

  // ── Config state ────────────────────────────────────────────────────────
  const [periodsPerDay, setPeriodsPerDay]   = useState(existingConfig?.periods_per_day ?? 7)
  const [periodDuration, setPeriodDuration] = useState(existingConfig?.period_duration_min ?? 50)
  const [firstPeriod, setFirstPeriod]       = useState(existingConfig?.first_period_start ?? '08:00')
  const [workingDays, setWorkingDays]       = useState<number[]>(existingConfig ? [] : [0,1,2,3,4])
  const [maxPerDay, setMaxPerDay]           = useState(existingConfig?.max_periods_per_day ?? 7)
  const [minPerDay, setMinPerDay]           = useState(existingConfig?.min_periods_per_day ?? 4)
  const [avoidWindows, setAvoidWindows]     = useState(existingConfig?.avoid_teacher_windows ?? true)
  const [hardMorning, setHardMorning]       = useState(existingConfig?.hard_subjects_morning ?? true)

  // ── Assignments state ───────────────────────────────────────────────────
  // Group existing assignments by teacher+subject+periods_per_week
  const groupedExisting = existingAssignments.reduce((acc: Record<string, AssignmentDraft>, a) => {
    const key = `${a.teacher_id}__${a.subject_id}__${a.periods_per_week}`
    if (!acc[key]) {
      acc[key] = { teacher_id: a.teacher_id, subject_id: a.subject_id, class_configs: [], group_id: a.group_id, lesson_type: a.lesson_type }
    }
    if (a.class_id && !acc[key].class_configs.find((cc: ClassConfig) => cc.class_id === a.class_id)) {
      acc[key].class_configs.push({ class_id: a.class_id, periods_per_week: a.periods_per_week ?? 2, requires_consecutive: a.requires_consecutive })
    }
    return acc
  }, {})
  const [assignments, setAssignments] = useState<AssignmentDraft[]>(Object.values(groupedExisting))

  const [sections, setSections] = useState({ config: true, assignments: existingAssignments.length === 0 })
  const toggle = (s: keyof typeof sections) => setSections(p => ({ ...p, [s]: !p[s] }))

  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // ── Period preview ──────────────────────────────────────────────────────
  function periodTime(idx: number) {
    const [h, m] = firstPeriod.split(':').map(Number)
    const start = h * 60 + m + idx * (periodDuration + 10)
    const end = start + periodDuration
    const fmt = (n: number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
    return `${fmt(start)}–${fmt(end)}`
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function saveAll() {
    setSaving(true)
    const res = await fetch(`/api/schedules/${scheduleId}/school-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { periodsPerDay, periodDuration, firstPeriod, workingDays, maxPerDay, minPerDay, avoidWindows, hardMorning },
        // Expand multi-class: one AssignmentDraft with N class_configs → N assignments
        assignments: assignments.flatMap(a => a.class_configs.map(cc => ({ teacher_id: a.teacher_id, subject_id: a.subject_id, class_id: cc.class_id, group_id: a.group_id, lesson_type: a.lesson_type, periods_per_week: cc.periods_per_week, requires_consecutive: cc.requires_consecutive }))).filter(a => a.teacher_id && a.subject_id && a.class_id),
      }),
    })
    const result = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(result.error ?? 'Eroare la salvare'); return false }
    toast.success('Configurație salvată')
    return true
  }

  async function generate() {
    const ok = await saveAll()
    if (!ok) return
    setGenerating(true)
    const res = await fetch(`/api/schedules/${scheduleId}/generate-school`, { method: 'POST' })
    const result = await res.json()
    setGenerating(false)
    if (!res.ok) { toast.error(result.error ?? 'Eroare la generare'); return }
    toast.success(`Orar generat — ${result.stats?.scheduled_lessons ?? 0} ore`)
    router.push(`/${locale}/schedules/${scheduleId}/timetable`)
  }

  const noResources = teachers.length === 0 || subjects.length === 0 || classes.length === 0

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>
          {scheduleName}
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Configurare orar școlar · Resursele sunt preluate din{' '}
          <a href={`/${locale}/resources`} style={{ color: '#2563eb' }}>Resurse</a>
        </p>
      </div>

      {/* Warning if no resources */}
      {noResources && (
        <div style={{ padding: '14px 16px', marginBottom: '16px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '10px', fontSize: '13px', color: '#92400e' }}>
          ⚠️ Definește mai întâi{' '}
          {teachers.length === 0 && 'profesori, '}
          {subjects.length === 0 && 'materii, '}
          {classes.length === 0 && 'clase '}
          în pagina{' '}
          <a href={`/${locale}/resources`} style={{ color: '#d97706', fontWeight: 500 }}>Resurse</a>.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Config */}
        <Section icon={Settings} title="Configurare generală" subtitle="Ore pe zi, durată, zile lucrătoare" open={sections.config} onToggle={() => toggle('config')} badge={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '5px' }}>Prima oră</label>
              <input type="time" value={firstPeriod} onChange={e => setFirstPeriod(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '5px' }}>Ore per zi</label>
              <input type="number" min={4} max={12} value={periodsPerDay} onChange={e => setPeriodsPerDay(+e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '5px' }}>Durata (minute)</label>
              <input type="number" min={30} max={120} value={periodDuration} onChange={e => setPeriodDuration(+e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '5px' }}>Min/zi</label>
                <input type="number" min={1} max={maxPerDay} value={minPerDay} onChange={e => setMinPerDay(+e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '5px' }}>Max/zi</label>
                <input type="number" min={minPerDay} max={12} value={maxPerDay} onChange={e => setMaxPerDay(+e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Zile lucrătoare</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DAYS.map((d, i) => (
                <button key={i} type="button"
                  onClick={() => setWorkingDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i].sort())}
                  style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, background: workingDays.includes(i) ? '#2563eb' : '#f3f4f6', color: workingDays.includes(i) ? '#fff' : '#6b7280' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Period preview */}
          <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Array.from({ length: periodsPerDay }, (_, i) => (
                <span key={i} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#fff', border: '0.5px solid #e5e7eb', color: '#374151' }}>
                  Ora {i+1}: {periodTime(i)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Ferestre minime profesori', val: avoidWindows, set: setAvoidWindows },
              { label: 'Materii grele dimineața', val: hardMorning, set: setHardMorning },
            ].map(({ label, val, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: '#374151' }}>{label}</span>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
              </label>
            ))}
          </div>
        </Section>

        {/* Assignments */}
        <Section icon={Zap} title="Asignări" subtitle="Cine predă ce, la ce clasă, câte ore/săpt" open={sections.assignments} onToggle={() => toggle('assignments')} badge={assignments.reduce((sum, a) => sum + Math.max(a.class_configs.length, 1), 0)}>
          {noResources ? (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>Completează mai întâi resursele în pagina Resurse.</p>
          ) : (
            <>
              {/* Header */}
              {assignments.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 32px', gap: '8px', marginBottom: '6px', padding: '0 2px' }}>
                  {['Profesor', 'Materie', 'Clase (bifează → ore/săpt → 2h dacă e dublu)', ''].map(h => (
                    <span key={h} style={{ fontSize: '10px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>
              )}

              {assignments.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 32px', gap: '8px', marginBottom: '8px', alignItems: 'start' }}>
                  <select value={a.teacher_id} style={sel}
                    onChange={e => setAssignments(p => p.map((x,j) => j===i ? {...x,teacher_id:e.target.value} : x))}>
                    <option value="">Profesor...</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={a.subject_id} style={sel}
                    onChange={e => setAssignments(p => p.map((x,j) => j===i ? {...x,subject_id:e.target.value} : x))}>
                    <option value="">Materie...</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>

                  {/* Multi-class selector — checkbox + 2h toggle per class */}
                  <div style={{ border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '4px 8px', background: '#fff', maxHeight: '140px', overflowY: 'auto', overflowX: 'hidden' }}>
                    {classes.length === 0 && (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>Nicio clasă definită</span>
                    )}
                    {classes.map(c => {
                      const cfg = a.class_configs.find(cc => cc.class_id === c.id)
                      const isSelected = !!cfg
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '0.5px solid #f9fafb' }}>
                          {/* Class checkbox */}
                          <div style={{ width: '15px', height: '15px', borderRadius: '3px', flexShrink: 0, border: isSelected ? '2px solid #2563eb' : '1.5px solid #d1d5db', background: isSelected ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            onClick={() => setAssignments(p => p.map((x,j) => j!==i ? x : {
                              ...x,
                              class_configs: isSelected
                                ? x.class_configs.filter(cc => cc.class_id !== c.id)
                                : [...x.class_configs, { class_id: c.id, periods_per_week: 2, requires_consecutive: false }]
                            }))}>
                            {isSelected && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          {/* Class name */}
                          <span style={{ fontSize: '12px', color: '#374151', flex: 1, cursor: 'pointer' }}
                            onClick={() => setAssignments(p => p.map((x,j) => j!==i ? x : {
                              ...x,
                              class_configs: isSelected
                                ? x.class_configs.filter(cc => cc.class_id !== c.id)
                                : [...x.class_configs, { class_id: c.id, periods_per_week: 2, requires_consecutive: false }]
                            }))}>
                            {c.name}
                          </span>
                          {/* ore/săpt + 2h — only if class is selected */}
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <input
                                type="number" min={1} max={10}
                                value={cfg?.periods_per_week ?? 2}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setAssignments(p => p.map((x,j) => j!==i ? x : {
                                  ...x,
                                  class_configs: x.class_configs.map(cc => cc.class_id === c.id ? { ...cc, periods_per_week: +e.target.value } : cc)
                                }))}
                                style={{ width: '36px', border: '0.5px solid #d1d5db', borderRadius: '6px', padding: '2px 4px', fontSize: '11px', color: '#374151', background: '#fff', textAlign: 'center' }}
                              />
                              <span style={{ fontSize: '10px', color: '#9ca3af' }}>ore</span>
                              <span
                                onClick={e => { e.stopPropagation(); setAssignments(p => p.map((x,j) => j!==i ? x : {
                                  ...x,
                                  class_configs: x.class_configs.map(cc => cc.class_id === c.id ? { ...cc, requires_consecutive: !cc.requires_consecutive } : cc)
                                })) }}
                                title="Ore duble consecutive (lab, sport)"
                                style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap',
                                  background: cfg?.requires_consecutive ? '#2563eb' : '#f3f4f6',
                                  color: cfg?.requires_consecutive ? '#fff' : '#9ca3af',
                                  border: `0.5px solid ${cfg?.requires_consecutive ? '#2563eb' : '#e5e7eb'}`,
                                }}>
                                2h
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {a.class_configs.length > 0 && (
                      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px', paddingTop: '3px' }}>
                        {a.class_configs.length} {a.class_configs.length === 1 ? 'clasă' : 'clase'}
                        {' · '}{a.class_configs.map(cc => cc.periods_per_week).join('/')} ore/săpt
                        {a.class_configs.some(cc => cc.requires_consecutive) && ' · unele 2h'}
                      </div>
                    )}
                  </div>


                  <button onClick={() => setAssignments(p => p.filter((_,j) => j!==i))}
                    style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              ))}

              <button onClick={() => setAssignments(p => [...p, { teacher_id: '', subject_id: '', class_configs: [], group_id: null, lesson_type: 'regular' }])}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Adaugă asignare
              </button>
            </>
          )}
        </Section>
        </div>{/* end left column */}

        {/* Right: help panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '16px' }}>
          {sections.config && (
            <>
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>Configurare generală</p>
                <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
                  Definește structura zilei școlare — câte ore are, cât durează fiecare oră și ce zile sunt lucrătoare.
                </p>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Câmpuri</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Prima oră', hint: 'ex: 08:00 — când începe ziua' },
                    { label: 'Ore per zi', hint: 'Numărul de ore în program' },
                    { label: 'Durată', hint: 'Minute per oră (standard 50)' },
                    { label: 'Min/Max pe zi', hint: 'Limite per clasă per zi' },
                    { label: 'Zile', hint: 'Zilele în care se ține cursul' },
                  ].map(({ label, hint }) => (
                    <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
                  Preview-ul de jos arată orele calculate automat pe baza orei de start și duratei.
                </p>
              </div>
            </>
          )}
          {sections.assignments && (
            <>
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>Asignări</p>
                <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
                  Definește cine predă ce și la ce clase. Un rând poate acoperi mai multe clase dacă profesorul predă aceeași materie cu același număr de ore.
                </p>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Câmpuri</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Profesor', hint: 'Selectează din lista definită în Resurse' },
                    { label: 'Materie', hint: 'Materia predată' },
                    { label: 'Clase', hint: 'Bifează toate clasele la care predă această materie' },
                    { label: '2h', hint: 'Apare lângă clasă — activează pentru ore duble consecutive (lab, sport)' },
                    { label: 'Ore/săpt', hint: 'Câte ore pe săptămână are această materie' },
                  ].map(({ label, hint }) => (
                    <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
                  Un rând cu 3 clase bifate → 3 asignări separate în orar. Dacă ore/săpt diferă între clase, adaugă rânduri separate.
                </p>
              </div>
            </>
          )}
        </div>{/* end right panel */}

      </div>{/* end grid */}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '20px', borderTop: '0.5px solid #e5e7eb' }}>
        <button onClick={saveAll} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
          Salvează
        </button>
        <button onClick={generate} disabled={generating || saving || assignments.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: (generating || assignments.length === 0) ? 0.6 : 1 }}>
          {generating ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Zap style={{ width: '14px', height: '14px' }} />}
          Generează orarul
        </button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}