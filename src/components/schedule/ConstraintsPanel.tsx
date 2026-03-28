'use client'

// Complete schedule settings panel — all wizard settings editable in one place.
// Tabs: Settings (dates, days, holidays), Shifts (slots + rules), Constraints.
// "Salvează și regenerează" saves all changes then re-runs the generation algorithm.
// Used by: schedules/[id]/page.tsx.

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Plus, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { DatePicker } from '@/components/ui/DatePicker'
import type { Employee, ShiftDefinition } from '@/types'

interface Constraint {
  id: string; type: string
  employee_id: string | null; target_employee_id: string | null
  shift_definition_id: string | null; value: number | null; note: string | null
}
interface ScheduleShift {
  shift_definition_id: string; slots_per_day: number; shift_definitions: any
}
interface Schedule {
  id: string; name: string; start_date: string; end_date: string
  working_days: number[]; include_holidays: boolean; country_code: string
  generation_config: any
}
interface Props {
  scheduleId: string; schedule: Schedule
  initialConstraints: Constraint[]; employees: Employee[]
  shiftDefinitions: ShiftDefinition[]; scheduleShifts: ScheduleShift[]
}

const CTYPES = ['pair_required','pair_forbidden','rest_after_shift','max_consecutive','max_weekly_hours','max_night_shifts','min_seniority','min_staff','fixed_shift']
const NEEDS_VALUE  = ['rest_after_shift','max_consecutive','max_weekly_hours','max_night_shifts','min_staff']
const NEEDS_TARGET = ['pair_required','pair_forbidden']
const NEEDS_SHIFT  = ['rest_after_shift','min_seniority','min_staff','fixed_shift']
const DAYS = [{v:1,l:'Lun'},{v:2,l:'Mar'},{v:3,l:'Mie'},{v:4,l:'Joi'},{v:5,l:'Vin'},{v:6,l:'Sâm'},{v:7,l:'Dum'}]
const COUNTRIES = [
  {code:'RO',name:'România'},{code:'DE',name:'Germania'},{code:'FR',name:'Franța'},
  {code:'ES',name:'Spania'},{code:'IT',name:'Italia'},{code:'GB',name:'Regatul Unit'},
  {code:'PL',name:'Polonia'},{code:'HU',name:'Ungaria'},{code:'US',name:'SUA'},
]

export function ConstraintsPanel({ scheduleId, schedule, initialConstraints, employees, shiftDefinitions, scheduleShifts }: Props) {
  const tCon = useTranslations('constraints')
  const gc = schedule.generation_config ?? {}

  const [open, setOpen] = useState(true)
  const [tab, setTab]   = useState<'settings'|'shifts'|'constraints'>('settings')
  const [busy, setBusy] = useState(false)

  // Settings
  const [startDate,    setStartDate]    = useState(schedule.start_date)
  const [endDate,      setEndDate]      = useState(schedule.end_date)
  const [workingDays,  setWorkingDays]  = useState<number[]>(schedule.working_days ?? [1,2,3,4,5])
  const [inclHolidays, setInclHolidays] = useState(schedule.include_holidays)
  const [country,      setCountry]      = useState(schedule.country_code)

  // Shifts config
  const [minPerShift, setMinPerShift] = useState<number>(gc.min_employees_per_shift ?? 1)
  const [maxConsec,   setMaxConsec]   = useState<number>(gc.max_consecutive_days ?? 6)
  const [minRest,     setMinRest]     = useState<number>(gc.min_rest_hours_between_shifts ?? 11)
  const [maxWeekly,   setMaxWeekly]   = useState<number>(gc.max_weekly_hours ?? 48)
  const [maxNight,    setMaxNight]    = useState<number>(gc.max_night_shifts_per_week ?? 3)
  const [legalLimits, setLegalLimits] = useState<boolean>(gc.enforce_legal_limits ?? true)
  const [balance,     setBalance]     = useState<boolean>(gc.balance_shift_distribution ?? true)
  const [consistency, setConsistency] = useState<number>(gc.shift_consistency ?? 2)
  const [slots, setSlots] = useState<Record<string,number>>(
    Object.fromEntries(scheduleShifts.map(ss => [ss.shift_definition_id, ss.slots_per_day ?? 1]))
  )

  // Constraints
  const [constraints, setConstraints] = useState(initialConstraints)
  const [showForm,    setShowForm]    = useState(false)
  const [cForm, setCForm] = useState({ type:'pair_required', employee_id:'', target_employee_id:'', shift_definition_id:'', value:'', note:'' })

  const LABELS: Record<string,string> = {
    pair_required: tCon('pairRequired'), pair_forbidden: tCon('pairForbidden'),
    rest_after_shift: tCon('restAfterShift'), max_consecutive: tCon('maxConsecutive'),
    max_weekly_hours: tCon('maxWeeklyHours'), max_night_shifts: tCon('maxNightShifts'),
    min_seniority: tCon('minSeniority'), min_staff: tCon('minStaff'), fixed_shift: tCon('fixedShift'),
  }

  const empName   = (id: string | null) => employees.find(e => e.id === id)?.name ?? '?'
  const shiftName = (id: string | null) => shiftDefinitions.find(s => s.id === id)?.name ?? '?'
  const inp = { border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' } as React.CSSProperties

  const toggleDay = (d: number) =>
    setWorkingDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d].sort())

  async function handleRegenerate() {
    setBusy(true)
    try {
      // Save settings
      const [r1, r2] = await Promise.all([
        fetch(`/api/schedules/${scheduleId}/settings`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: startDate, end_date: endDate, working_days: workingDays, include_holidays: inclHolidays, country_code: country }),
        }),
        fetch(`/api/schedules/${scheduleId}/config`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationConfig: { min_employees_per_shift: minPerShift, max_consecutive_days: maxConsec, min_rest_hours_between_shifts: minRest, max_weekly_hours: maxWeekly, max_night_shifts_per_week: maxNight, enforce_legal_limits: legalLimits, balance_shift_distribution: balance, shift_consistency: consistency },
            slots: Object.entries(slots).map(([shift_definition_id, slots_per_day]) => ({ shift_definition_id, slots_per_day })),
          }),
        }),
      ])
      if (!r1.ok || !r2.ok) { toast.error('Eroare la salvarea setărilor'); return }
      const genRes = await fetch(`/api/schedules/${scheduleId}/generate`, { method: 'POST' })
      const result = await genRes.json()
      if (!genRes.ok) { toast.error(result.error ?? 'Eroare la generare'); return }
      toast.success(`Regenerat — ${result.stats?.filledSlots ?? 0} asignări`)
      window.location.reload()
    } catch { toast.error('Eroare de rețea') }
    finally { setBusy(false) }
  }

  async function deleteConstraint(id: string) {
    const res = await fetch(`/api/schedules/${scheduleId}/constraints`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ constraintId: id }),
    })
    if (res.ok) setConstraints(prev => prev.filter(c => c.id !== id))
    else toast.error('Eroare la ștergere')
  }

  async function addConstraint() {
    const res = await fetch(`/api/schedules/${scheduleId}/constraints`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: cForm.type, employee_id: cForm.employee_id||null, target_employee_id: cForm.target_employee_id||null, shift_definition_id: cForm.shift_definition_id||null, value: cForm.value ? Number(cForm.value) : null, note: cForm.note||null }),
    })
    const result = await res.json()
    if (!res.ok) { toast.error(result.error ?? 'Eroare'); return }
    setConstraints(prev => [...prev, result.constraint])
    setShowForm(false)
    setCForm({ type:'pair_required', employee_id:'', target_employee_id:'', shift_definition_id:'', value:'', note:'' })
  }

  const RegenerateBtn = (
    <button onClick={handleRegenerate} disabled={busy}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
      style={{ background: '#2563eb' }}>
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      Salvează și regenerează
    </button>
  )

  return (
    <div className="bg-white rounded-xl mt-4 print-hide" style={{ border: '0.5px solid #e5e7eb' }}>
      {/* Header — div not button to avoid nested button hydration error */}
      <div
        onClick={() => setOpen(o=>!o)}
        className="flex items-center justify-between px-5 py-3 cursor-pointer"
        style={{ borderBottom: open ? '0.5px solid #f3f4f6' : 'none' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#111827' }}>Setări orar</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>
            {constraints.length} constrângeri
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {open && RegenerateBtn}
          {open
            ? <ChevronUp className="w-4 h-4" style={{ color: '#9ca3af' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: '#9ca3af' }} />}
        </div>
      </div>

      {open && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 px-5 pt-2" style={{ borderBottom: '0.5px solid #f3f4f6' }}>
            {[{id:'settings',label:'Setări generale'},{id:'shifts',label:'Ture și reguli'},{id:'constraints',label:`Constrângeri (${constraints.length})`}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className="px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
                style={{ borderBottomColor: tab===t.id?'#2563eb':'transparent', color: tab===t.id?'#1d4ed8':'#6b7280', background:'transparent' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Settings ──────────────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <DatePicker label="Data de început" value={startDate} onChange={setStartDate} placeholder="Alege data" />
                <DatePicker label="Data de sfârșit" value={endDate} onChange={setEndDate} placeholder="Alege data" minDate={startDate} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>Zile lucrătoare</label>
                <div className="flex gap-2">
                  {DAYS.map(({v,l}) => (
                    <button key={v} type="button" onClick={() => toggleDay(v)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: workingDays.includes(v)?'#2563eb':'#f3f4f6', color: workingDays.includes(v)?'#fff':'#6b7280' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color:'#111827' }}>{inclHolidays?'Se lucrează în sărbători':'Sărbătorile sunt libere'}</p>
                    <p className="text-xs mt-0.5" style={{ color:'#6b7280' }}>{inclHolidays?'Zilele de sărbătoare sunt incluse':'Zilele de sărbătoare nu sunt incluse'}</p>
                  </div>
                  <input type="checkbox" checked={inclHolidays} onChange={e=>setInclHolidays(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color:'#374151' }}>Țara</label>
                  <select value={country} onChange={e=>setCountry(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={inp}>
                    {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Shifts ────────────────────────────────────────────────────── */}
          {tab === 'shifts' && (
            <div className="p-5 space-y-5">
              {scheduleShifts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color:'#374151' }}>Angajați necesari per tură / zi</label>
                  <div className="grid grid-cols-3 gap-3">
                    {scheduleShifts.map(ss => (
                      <div key={ss.shift_definition_id} className="p-3 rounded-xl" style={{ border:'0.5px solid #e5e7eb' }}>
                        <p className="text-xs font-medium mb-0.5" style={{ color:'#111827' }}>{ss.shift_definitions?.name ?? shiftName(ss.shift_definition_id)}</p>
                        <p className="text-xs mb-2" style={{ color:'#9ca3af' }}>{ss.shift_definitions?.start_time}–{ss.shift_definitions?.end_time}</p>
                        <input type="number" min={1} max={20} value={slots[ss.shift_definition_id]??1}
                          onChange={e=>setSlots(s=>({...s,[ss.shift_definition_id]:Number(e.target.value)}))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" style={inp} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color:'#374151' }}>Reguli de generare</label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    {label:'Min angajați / tură', val:minPerShift, set:setMinPerShift, min:1, max:20},
                    {label:'Max zile consecutive', val:maxConsec, set:setMaxConsec, min:1, max:14},
                    {label:'Min repaus (ore)', val:minRest, set:setMinRest, min:8, max:24},
                    {label:'Max ore / săptămână', val:maxWeekly, set:setMaxWeekly, min:20, max:80},
                    {label:'Max ture noapte / săpt', val:maxNight, set:setMaxNight, min:0, max:7},
                  ].map(({label,val,set,min,max})=>(
                    <div key={label}>
                      <label className="block text-xs font-medium mb-1" style={{ color:'#374151' }}>{label}</label>
                      <input type="number" min={min} max={max} value={val} onChange={e=>set(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" style={inp} />
                    </div>
                  ))}
                </div>
                {/* Shift consistency control */}
                <div className="p-3 rounded-xl" style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color:'#111827' }}>Consistență ture</p>
                      <p className="text-xs mt-0.5" style={{ color:'#6b7280' }}>
                        {consistency === 0 ? 'Dezactivat — rotație liberă' : consistency === 1 ? 'Ușoară — preferă aceeași tură' : 'Puternică — zile consecutive pe aceeași tură'}
                      </p>
                    </div>
                    <span className="text-sm font-medium px-2 py-0.5 rounded" style={{ background:'#eff6ff', color:'#1d4ed8' }}>
                      {['Off','Ușor','Puternic'][consistency]}
                    </span>
                  </div>
                  <input type="range" min={0} max={2} step={1} value={consistency}
                    onChange={e => setConsistency(Number(e.target.value))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs mt-1" style={{ color:'#9ca3af' }}>
                    <span>Rotație liberă</span>
                    <span>Ușor</span>
                    <span>Zile consecutive</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:'Limite legale UE', hint:'Min 11h repaus, max 48h/săpt, max 6 zile', val:legalLimits, set:setLegalLimits},
                    {label:'Distribuie echilibrat', hint:'Împarte turele uniform între angajați', val:balance, set:setBalance},
                  ].map(({label,hint,val,set})=>(
                    <label key={label} className="flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer" style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color:'#111827' }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color:'#6b7280' }}>{hint}</p>
                      </div>
                      <input type="checkbox" checked={val} onChange={e=>set(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-blue-600" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Constraints ───────────────────────────────────────────────── */}
          {tab === 'constraints' && (
            <div>
              <div className="px-5 py-3" style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                {!showForm ? (
                  <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 text-xs" style={{ color:'#2563eb' }}>
                    <Plus className="w-3 h-3" /> Adaugă constrângere
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2 items-end">
                    <select value={cForm.type} onChange={e=>setCForm(f=>({...f,type:e.target.value}))} className="px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" style={inp}>
                      {CTYPES.map(t=><option key={t} value={t}>{LABELS[t]}</option>)}
                    </select>
                    <select value={cForm.employee_id} onChange={e=>setCForm(f=>({...f,employee_id:e.target.value}))} className="px-2 py-1.5 rounded-lg text-xs" style={inp}>
                      <option value="">Toți angajații</option>
                      {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {NEEDS_TARGET.includes(cForm.type) && (
                      <select value={cForm.target_employee_id} onChange={e=>setCForm(f=>({...f,target_employee_id:e.target.value}))} className="px-2 py-1.5 rounded-lg text-xs" style={inp}>
                        <option value="">Al doilea angajat</option>
                        {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    )}
                    {NEEDS_SHIFT.includes(cForm.type) && (
                      <select value={cForm.shift_definition_id} onChange={e=>setCForm(f=>({...f,shift_definition_id:e.target.value}))} className="px-2 py-1.5 rounded-lg text-xs" style={inp}>
                        <option value="">Tură (opțional)</option>
                        {shiftDefinitions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    {NEEDS_VALUE.includes(cForm.type) && (
                      <input type="number" value={cForm.value} onChange={e=>setCForm(f=>({...f,value:e.target.value}))} placeholder="Valoare" className="px-2 py-1.5 rounded-lg text-xs w-20" style={inp} />
                    )}
                    <input type="text" value={cForm.note} onChange={e=>setCForm(f=>({...f,note:e.target.value}))} placeholder="Notă (opțional)" className="px-2 py-1.5 rounded-lg text-xs flex-1 min-w-32" style={inp} />
                    <button onClick={addConstraint} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background:'#2563eb' }}>Salvează</button>
                    <button onClick={()=>setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ border:'0.5px solid #d1d5db', color:'#374151' }}>Anulează</button>
                  </div>
                )}
              </div>
              {constraints.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color:'#e5e7eb' }} />
                  <p className="text-xs" style={{ color:'#9ca3af' }}>Nicio constrângere activă</p>
                </div>
              ) : constraints.map((c,i) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop:'0.5px solid #f9fafb' }}>
                  <div className="min-w-0">
                    <span className="text-xs font-medium" style={{ color:'#111827' }}>{LABELS[c.type]??c.type}</span>
                    <span className="text-xs ml-2" style={{ color:'#6b7280' }}>
                      {c.employee_id && empName(c.employee_id)}
                      {c.target_employee_id && ` ↔ ${empName(c.target_employee_id)}`}
                      {c.shift_definition_id && ` (${shiftName(c.shift_definition_id)})`}
                      {c.value!=null && ` = ${c.value}`}
                    </span>
                    {c.note && <span className="text-xs ml-2 italic" style={{ color:'#9ca3af' }}>{c.note}</span>}
                  </div>
                  <button onClick={()=>deleteConstraint(c.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 ml-3 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop:'0.5px solid #f3f4f6', background:'#fafafa', borderRadius:'0 0 12px 12px' }}>
            <p className="text-xs" style={{ color:'#9ca3af' }}>
              Modifică setările → <strong style={{ color:'#374151' }}>Salvează și regenerează</strong>
            </p>
            {RegenerateBtn}
          </div>
        </>
      )}
    </div>
  )
}
