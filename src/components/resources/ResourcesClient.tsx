'use client'

// ResourcesClient — CRUD pentru resursele școlii.
//
// Tabs: Profesori | Materii | Săli | Clase | Timp
//
// Edit pattern: optimistic local update + debounce 1.5s → API call per câmp.
// Add: insert imediat în DB, auto-focus pe noul rând.
// Delete: imediat cu cascade (lecții + curriculum).
//
// Noile câmpuri față de v2:
//   Profesori: unavailable_slots, preferred_slots, max/min_lessons_per_day/week
//   Materii:   required_room_type (nullable), difficulty
//   Clase:     grade_number, stage, max_lessons_per_day, homeroom_id
//   Săli:      type (noua enum), capacity
//   Timp:      days_per_week, slots_per_day (salvate în organizations)
//
// Used by: /resources/page.tsx

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type {
  SchoolResources, SchoolTeacher, SchoolSubject,
  SchoolClass, SchoolRoom, RoomType, SubjectDifficulty, ClassStage
} from '@/types'

interface Props {
  orgId: string
  initialResources: SchoolResources
  initialTimeConfig?: { days_per_week: number; slots_per_day: number }
}

type Tab = 'teachers' | 'subjects' | 'rooms' | 'classes' | 'time'

const COLORS = [
  '#6366f1','#2563eb','#0891b2','#059669',
  '#d97706','#dc2626','#7c3aed','#db2777','#ea580c','#65a30d',
]

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'homeroom',      label: 'Clasă (homeroom)' },
  { value: 'gym',           label: 'Sală sport' },
  { value: 'computer_lab',  label: 'Laborator IT' },
  { value: 'chemistry_lab', label: 'Laborator chimie' },
  { value: 'generic',       label: 'Generic' },
]

const STAGES: { value: ClassStage; label: string }[] = [
  { value: 'primary',    label: 'Primar (0-4)' },
  { value: 'middle',     label: 'Gimnaziu (5-8)' },
  { value: 'high',       label: 'Liceu (9-12)' },
  { value: 'university', label: 'Universitate' },
]

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']

const inp: React.CSSProperties = {
  border: '0.5px solid #d1d5db', background: '#fff', color: '#111827',
  borderRadius: '8px', padding: '7px 10px', fontSize: '13px',
  width: '100%', boxSizing: 'border-box' as const,
}
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const rowStyle: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '0.5px solid #f3f4f6',
  alignItems: 'center', display: 'grid', gap: '8px',
}
const headerStyle: React.CSSProperties = {
  padding: '6px 14px', borderBottom: '0.5px solid #e5e7eb',
  background: '#f9fafb', display: 'grid', gap: '8px', alignItems: 'center',
}
const lbl: React.CSSProperties = {
  fontSize: '11px', fontWeight: 500, color: '#9ca3af',
  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiInsert(table: string, data: Record<string, unknown>) {
  const res = await fetch('/api/resources', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, data }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error ?? 'Eroare')
  return result.data
}

async function apiUpdate(table: string, id: string, data: Record<string, unknown>) {
  const res = await fetch('/api/resources', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id, data }),
  })
  if (!res.ok) { const r = await res.json(); throw new Error(r.error ?? 'Eroare') }
}

async function apiDelete(table: string, id: string) {
  const res = await fetch('/api/resources', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id }),
  })
  if (!res.ok) { const r = await res.json(); throw new Error(r.error ?? 'Eroare') }
}

// ── Help panel content ────────────────────────────────────────────────────────

const HELP: Record<Tab, { title: string; desc: string; fields: { label: string; hint: string }[] }> = {
  teachers: {
    title: 'Profesori',
    desc: 'Profesorii instituției. Definiți o singură dată, reutilizați în orice orar. Algoritmul garantează că un profesor nu e în două clase simultan.',
    fields: [
      { label: 'Nume',          hint: 'Numele complet' },
      { label: 'Max ore/zi',    hint: 'Hard constraint — null înseamnă fără limită' },
      { label: 'Max ore/săpt',  hint: 'Hard constraint — ex: 18 (normă didactică)' },
      { label: 'Min ore/săpt',  hint: 'Normă minimă — hard când setat' },
      { label: 'Indisponibil',  hint: 'Sloturi în care nu poate preda (click pe celule)' },
      { label: 'Preferate',     hint: 'Sloturi preferate — soft constraint cu weight' },
    ],
  },
  subjects: {
    title: 'Materii',
    desc: 'Materiile predate. Dificultatea influențează plasarea — greu = dimineața (soft constraint). Tipul de sală e folosit la asignarea automată.',
    fields: [
      { label: 'Materie',    hint: 'Numele complet (ex: Matematică)' },
      { label: 'Scurt',      hint: 'Prescurtare pentru carduri (ex: Mat)' },
      { label: 'Dificultate', hint: 'Hard → dimineața · Mediu/Ușor → oricând' },
      { label: 'Sală',       hint: 'Tipul de sală necesar — null = orice sală' },
      { label: 'Culoare',    hint: 'Vizualizare în orar' },
    ],
  },
  rooms: {
    title: 'Săli',
    desc: 'Sălile disponibile. Sala e asignată automat în funcție de tipul cerut de materie. Poate fi editată manual după generare.',
    fields: [
      { label: 'Sală',       hint: 'Denumire (ex: Sala 101, Lab Chimie)' },
      { label: 'Tip',        hint: 'Clasă, laborator, sport etc.' },
      { label: 'Capacitate', hint: 'Opțional — pentru verificări viitoare' },
    ],
  },
  classes: {
    title: 'Clase',
    desc: 'Clasele sau seriile instituției. Fiecare clasă primește propriul orar. Etapa influențează soft constraints (ex: clase primare nu la ultima oră).',
    fields: [
      { label: 'Clasă',       hint: 'Ex: 9A, Grupa CTI-1' },
      { label: 'An',          hint: 'Numărul anului de studiu' },
      { label: 'Etapă',       hint: 'Primar/Gimnaziu/Liceu/Universitate' },
      { label: 'Max ore/zi',  hint: 'Hard constraint per clasă (ex: 6)' },
      { label: 'Sala clasei', hint: 'Homeroom — sala default a clasei' },
    ],
  },
  time: {
    title: 'Configurare timp',
    desc: 'Configurarea grilei orare a instituției. Se moștenește în orice orar nou și poate fi suprascrisă per orar.',
    fields: [
      { label: 'Zile/săpt',    hint: 'Numărul de zile lucrătoare (5 = Lun-Vin)' },
      { label: 'Sloturi/zi',   hint: 'Numărul maxim de ore pe zi (ex: 8)' },
    ],
  },
}

// ── SlotPicker — UI pentru unavailable/preferred slots ───────────────────────
// Afișează o grilă zile × sloturi, click togglează slot-ul

interface SlotPickerProps {
  value: string[]
  onChange: (slots: string[]) => void
  daysPerWeek: number
  slotsPerDay: number
  color?: string
  label?: string
}

function SlotPicker({ value, onChange, daysPerWeek, slotsPerDay, color = '#dc2626', label }: SlotPickerProps) {
  const [open, setOpen] = useState(false)
  const set = new Set(value)

  function toggle(day: number, period: number) {
    const key = `${day}-${period}`
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange([...next])
  }

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ fontSize: '12px', padding: '4px 10px', border: '0.5px solid #d1d5db',
          borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#374151' }}>
        {value.length > 0 ? `${value.length} sloturi` : '—'} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: '6px', background: '#f9fafb', border: '0.5px solid #e5e7eb',
          borderRadius: '8px', padding: '10px', display: 'inline-block' }}>
          {label && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px' }}>{label}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${slotsPerDay}, 28px)`, gap: '3px', alignItems: 'center' }}>
            <span style={{ ...lbl, fontSize: '10px' }}></span>
            {Array.from({ length: slotsPerDay }, (_, p) => (
              <span key={p} style={{ ...lbl, fontSize: '10px', textAlign: 'center' }}>S{p+1}</span>
            ))}
            {Array.from({ length: daysPerWeek }, (_, d) => (
              <>
                <span key={`d${d}`} style={{ fontSize: '11px', color: '#6b7280' }}>{DAY_NAMES[d]}</span>
                {Array.from({ length: slotsPerDay }, (_, p) => {
                  const key = `${d}-${p}`
                  const active = set.has(key)
                  return (
                    <button key={key} onClick={() => toggle(d, p)}
                      title={`${DAY_NAMES[d]} S${p+1}`}
                      style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px',
                        cursor: 'pointer', fontSize: '9px',
                        background: active ? color : '#e5e7eb',
                        color: active ? '#fff' : 'transparent' }}>
                      ✓
                    </button>
                  )
                })}
              </>
            ))}
          </div>
          <button onClick={() => { onChange([]); setOpen(false) }}
            style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af',
              background: 'none', border: 'none', cursor: 'pointer' }}>
            Resetează
          </button>
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResourcesClient({ orgId, initialResources, initialTimeConfig }: Props) {
  const [tab, setTab]           = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<SchoolTeacher[]>(initialResources.teachers)
  const [subjects, setSubjects] = useState<SchoolSubject[]>(initialResources.subjects)
  const [classes,  setClasses]  = useState<SchoolClass[]>(initialResources.classes)
  const [rooms,    setRooms]    = useState<SchoolRoom[]>(initialResources.rooms)
  const [newRowId, setNewRowId] = useState<string | null>(null)
  const newRowRef = useRef<HTMLInputElement>(null)

  // TimeConfig state
  const [daysPerWeek,  setDaysPerWeek]  = useState(initialTimeConfig?.days_per_week  ?? 5)
  const [slotsPerDay,  setSlotsPerDay]  = useState(initialTimeConfig?.slots_per_day  ?? 8)

  useEffect(() => {
    if (newRowId && newRowRef.current) {
      newRowRef.current.focus()
      newRowRef.current.select()
    }
  }, [newRowId])

  const debouncedUpdate = useDebounce(async (table: string, id: string, data: Record<string, unknown>) => {
    try { await apiUpdate(table, id, data) }
    catch (e: any) { toast.error(e.message) }
  }, 1500)

  async function immediateUpdate(table: string, id: string, data: Record<string, unknown>) {
    try { await apiUpdate(table, id, data) }
    catch (e: any) { toast.error(e.message) }
  }

  async function addRow(table: string, data: Record<string, unknown>, setter: (fn: (p: any[]) => any[]) => void) {
    try {
      const row = await apiInsert(table, data)
      setter(p => [...p, row])
      setNewRowId(row.id)
    } catch (e: any) { toast.error(e.message) }
  }

  async function removeRow(table: string, id: string, setter: (fn: (p: any[]) => any[]) => void) {
    try {
      await apiDelete(table, id)
      setter(p => p.filter((r: any) => r.id !== id))
    } catch (e: any) { toast.error(e.message) }
  }

  const help = HELP[tab]
  const TABS: { id: Tab; label: string }[] = [
    { id: 'teachers', label: `Profesori (${teachers.length})` },
    { id: 'subjects', label: `Materii (${subjects.length})` },
    { id: 'rooms',    label: `Săli (${rooms.length})` },
    { id: 'classes',  label: `Clase (${classes.length})` },
    { id: 'time',     label: 'Timp' },
  ]

  const delBtn = (onClick: () => void) => (
    <button onClick={onClick}
      style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px',
        background: '#fee2e2', color: '#dc2626', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Trash2 style={{ width: '14px', height: '14px' }} />
    </button>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>

      {/* ── Left: table ───────────────────────────────────────────────────── */}
      <div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', marginBottom: '16px' }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => { setTab(id); setNewRowId(null) }}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, marginBottom: '-1px',
                borderBottom: tab === id ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === id ? '#1d4ed8' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Teachers ─────────────────────────────────────────────────────── */}
        {tab === 'teachers' && (
          <>
            <div style={{ ...headerStyle, gridTemplateColumns: '1fr 60px 70px 70px 36px 36px 32px' }}>
              {['Nume','Max/zi','Max/săpt','Min/săpt','Culoare','',''].map(h => (
                <span key={h} style={lbl}>{h}</span>
              ))}
            </div>
            {teachers.length === 0 && (
              <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                Niciun profesor.
              </p>
            )}
            {teachers.map(t => (
              <div key={t.id}>
                <div style={{ ...rowStyle, gridTemplateColumns: '1fr 60px 70px 70px 36px 36px 32px' }}>
                  <input ref={t.id === newRowId ? newRowRef : undefined}
                    value={t.name} placeholder={t.id === newRowId ? 'ex: Ion Popescu' : ''} style={inp}
                    onChange={e => {
                      setTeachers(p => p.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))
                      debouncedUpdate('school_teachers', t.id, { name: e.target.value })
                    }} />
                  <input type="number" min={1} max={12}
                    value={t.max_lessons_per_day ?? ''} placeholder="—" style={inp}
                    onChange={e => {
                      const v = e.target.value ? +e.target.value : null
                      setTeachers(p => p.map(x => x.id === t.id ? { ...x, max_lessons_per_day: v } : x))
                      debouncedUpdate('school_teachers', t.id, { max_lessons_per_day: v })
                    }} />
                  <input type="number" min={1} max={40}
                    value={t.max_lessons_per_week ?? ''} placeholder="—" style={inp}
                    onChange={e => {
                      const v = e.target.value ? +e.target.value : null
                      setTeachers(p => p.map(x => x.id === t.id ? { ...x, max_lessons_per_week: v } : x))
                      debouncedUpdate('school_teachers', t.id, { max_lessons_per_week: v })
                    }} />
                  <input type="number" min={1} max={40}
                    value={t.min_lessons_per_week ?? ''} placeholder="—" style={inp}
                    onChange={e => {
                      const v = e.target.value ? +e.target.value : null
                      setTeachers(p => p.map(x => x.id === t.id ? { ...x, min_lessons_per_week: v } : x))
                      debouncedUpdate('school_teachers', t.id, { min_lessons_per_week: v })
                    }} />
                  <input type="color" value={t.color}
                    style={{ width: '36px', height: '36px', border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
                    onChange={e => {
                      setTeachers(p => p.map(x => x.id === t.id ? { ...x, color: e.target.value } : x))
                      immediateUpdate('school_teachers', t.id, { color: e.target.value })
                    }} />
                  {/* Slot indicator */}
                  <div style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center' }}>
                    {t.unavailable_slots?.length > 0
                      ? <span style={{ color: '#dc2626' }}>{t.unavailable_slots.length}✗</span>
                      : '—'}
                  </div>
                  {delBtn(() => removeRow('school_teachers', t.id, setTeachers))}
                </div>

                {/* Slot pickers — sub rând */}
                <div style={{ padding: '4px 14px 10px', borderBottom: '0.5px solid #f3f4f6',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <p style={{ ...lbl, marginBottom: '4px' }}>Indisponibil (roșu)</p>
                    <SlotPicker
                      value={t.unavailable_slots ?? []}
                      onChange={slots => {
                        setTeachers(p => p.map(x => x.id === t.id ? { ...x, unavailable_slots: slots } : x))
                        immediateUpdate('school_teachers', t.id, { unavailable_slots: slots })
                      }}
                      daysPerWeek={daysPerWeek} slotsPerDay={slotsPerDay}
                      color="#dc2626" label="Click = nu poate preda"
                    />
                  </div>
                  <div>
                    <p style={{ ...lbl, marginBottom: '4px' }}>Preferate (verde)</p>
                    <SlotPicker
                      value={t.preferred_slots ?? []}
                      onChange={slots => {
                        setTeachers(p => p.map(x => x.id === t.id ? { ...x, preferred_slots: slots } : x))
                        immediateUpdate('school_teachers', t.id, { preferred_slots: slots })
                      }}
                      daysPerWeek={daysPerWeek} slotsPerDay={slotsPerDay}
                      color="#059669" label="Click = preferă să predea"
                    />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 14px' }}>
              <button onClick={() => addRow('school_teachers', {
                name: '', color: COLORS[teachers.length % COLORS.length],
                unavailable_slots: [], preferred_slots: [],
                max_lessons_per_day: null, max_lessons_per_week: null, min_lessons_per_week: null,
              }, setTeachers)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                  color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Adaugă profesor
              </button>
            </div>
          </>
        )}

        {/* ── Subjects ─────────────────────────────────────────────────────── */}
        {tab === 'subjects' && (
          <>
            <div style={{ ...headerStyle, gridTemplateColumns: '2fr 80px 1fr 1fr 36px 32px' }}>
              {['Materie','Scurt','Dificultate','Sală necesară','Culoare',''].map(h => (
                <span key={h} style={lbl}>{h}</span>
              ))}
            </div>
            {subjects.length === 0 && (
              <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                Nicio materie.
              </p>
            )}
            {subjects.map(s => (
              <div key={s.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 80px 1fr 1fr 36px 32px' }}>
                <input ref={s.id === newRowId ? newRowRef : undefined}
                  value={s.name} placeholder={s.id === newRowId ? 'ex: Matematică' : ''} style={inp}
                  onChange={e => {
                    setSubjects(p => p.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))
                    debouncedUpdate('school_subjects', s.id, { name: e.target.value })
                  }} />
                <input value={s.short_name ?? ''} placeholder="Mat" style={inp}
                  onChange={e => {
                    setSubjects(p => p.map(x => x.id === s.id ? { ...x, short_name: e.target.value || null } : x))
                    debouncedUpdate('school_subjects', s.id, { short_name: e.target.value || null })
                  }} />
                <select value={s.difficulty} style={sel}
                  onChange={e => {
                    const v = e.target.value as SubjectDifficulty
                    setSubjects(p => p.map(x => x.id === s.id ? { ...x, difficulty: v } : x))
                    immediateUpdate('school_subjects', s.id, { difficulty: v })
                  }}>
                  <option value="hard">Greu</option>
                  <option value="medium">Mediu</option>
                  <option value="easy">Ușor</option>
                </select>
                <select value={s.required_room_type ?? ''} style={sel}
                  onChange={e => {
                    const v = e.target.value as RoomType || null
                    setSubjects(p => p.map(x => x.id === s.id ? { ...x, required_room_type: v } : x))
                    immediateUpdate('school_subjects', s.id, { required_room_type: v })
                  }}>
                  <option value="">Orice sală</option>
                  {ROOM_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input type="color" value={s.color}
                  style={{ width: '36px', height: '36px', border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
                  onChange={e => {
                    setSubjects(p => p.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))
                    immediateUpdate('school_subjects', s.id, { color: e.target.value })
                  }} />
                {delBtn(() => removeRow('school_subjects', s.id, setSubjects))}
              </div>
            ))}
            <div style={{ padding: '10px 14px' }}>
              <button onClick={() => addRow('school_subjects', {
                name: '', short_name: null, color: COLORS[subjects.length % COLORS.length],
                difficulty: 'medium', required_room_type: null,
              }, setSubjects)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                  color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Adaugă materie
              </button>
            </div>
          </>
        )}

        {/* ── Rooms ────────────────────────────────────────────────────────── */}
        {tab === 'rooms' && (
          <>
            <div style={{ ...headerStyle, gridTemplateColumns: '2fr 1fr 80px 32px' }}>
              {['Sală','Tip','Capacitate',''].map(h => <span key={h} style={lbl}>{h}</span>)}
            </div>
            {rooms.length === 0 && (
              <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                Nicio sală.
              </p>
            )}
            {rooms.map(r => (
              <div key={r.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 1fr 80px 32px' }}>
                <input ref={r.id === newRowId ? newRowRef : undefined}
                  value={r.name} placeholder={r.id === newRowId ? 'ex: Sala 101' : ''} style={inp}
                  onChange={e => {
                    setRooms(p => p.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))
                    debouncedUpdate('school_rooms', r.id, { name: e.target.value })
                  }} />
                <select value={r.type} style={sel}
                  onChange={e => {
                    const v = e.target.value as RoomType
                    setRooms(p => p.map(x => x.id === r.id ? { ...x, type: v } : x))
                    immediateUpdate('school_rooms', r.id, { type: v })
                  }}>
                  {ROOM_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
                <input type="number" min={1} value={r.capacity ?? ''} placeholder="—" style={inp}
                  onChange={e => {
                    const v = e.target.value ? +e.target.value : null
                    setRooms(p => p.map(x => x.id === r.id ? { ...x, capacity: v } : x))
                    debouncedUpdate('school_rooms', r.id, { capacity: v })
                  }} />
                {delBtn(() => removeRow('school_rooms', r.id, setRooms))}
              </div>
            ))}
            <div style={{ padding: '10px 14px' }}>
              <button onClick={() => addRow('school_rooms', {
                name: '', type: 'generic', capacity: null,
              }, setRooms)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                  color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Adaugă sală
              </button>
            </div>
          </>
        )}

        {/* ── Classes ──────────────────────────────────────────────────────── */}
        {tab === 'classes' && (
          <>
            <div style={{ ...headerStyle, gridTemplateColumns: '2fr 60px 1fr 60px 1fr 32px' }}>
              {['Clasă','An','Etapă','Max/zi','Sala clasei',''].map(h => (
                <span key={h} style={lbl}>{h}</span>
              ))}
            </div>
            {classes.length === 0 && (
              <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                Nicio clasă.
              </p>
            )}
            {classes.map(c => (
              <div key={c.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 60px 1fr 60px 1fr 32px' }}>
                <input ref={c.id === newRowId ? newRowRef : undefined}
                  value={c.name} placeholder={c.id === newRowId ? 'ex: 9A' : ''} style={inp}
                  onChange={e => {
                    setClasses(p => p.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))
                    debouncedUpdate('school_classes', c.id, { name: e.target.value })
                  }} />
                <input type="number" min={0} max={13} value={c.grade_number} style={inp}
                  onChange={e => {
                    setClasses(p => p.map(x => x.id === c.id ? { ...x, grade_number: +e.target.value } : x))
                    debouncedUpdate('school_classes', c.id, { grade_number: +e.target.value })
                  }} />
                <select value={c.stage} style={sel}
                  onChange={e => {
                    const v = e.target.value as ClassStage
                    setClasses(p => p.map(x => x.id === c.id ? { ...x, stage: v } : x))
                    immediateUpdate('school_classes', c.id, { stage: v })
                  }}>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="number" min={1} max={12} value={c.max_lessons_per_day} style={inp}
                  onChange={e => {
                    setClasses(p => p.map(x => x.id === c.id ? { ...x, max_lessons_per_day: +e.target.value } : x))
                    debouncedUpdate('school_classes', c.id, { max_lessons_per_day: +e.target.value })
                  }} />
                <select value={c.homeroom_id ?? ''} style={sel}
                  onChange={e => {
                    const v = e.target.value || null
                    setClasses(p => p.map(x => x.id === c.id ? { ...x, homeroom_id: v } : x))
                    immediateUpdate('school_classes', c.id, { homeroom_id: v })
                  }}>
                  <option value="">— fără homeroom —</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {delBtn(() => removeRow('school_classes', c.id, setClasses))}
              </div>
            ))}
            <div style={{ padding: '10px 14px' }}>
              <button onClick={() => addRow('school_classes', {
                name: '', grade_number: 9, stage: 'high',
                max_lessons_per_day: 6, homeroom_id: null,
              }, setClasses)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                  color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Adaugă clasă
              </button>
            </div>
          </>
        )}

        {/* ── Time config ──────────────────────────────────────────────────── */}
        {tab === 'time' && (
          <div style={{ padding: '20px 14px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              Configurarea grilei orare a instituției. Se moștenește în orice orar nou.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280' }}>
                Zile lucrătoare/săpt
                <input type="number" min={1} max={7} value={daysPerWeek} style={{ ...inp, marginTop: '4px' }}
                  onChange={e => setDaysPerWeek(+e.target.value)} />
              </label>
              <label style={{ fontSize: '12px', color: '#6b7280' }}>
                Sloturi maxime/zi
                <input type="number" min={1} max={16} value={slotsPerDay} style={{ ...inp, marginTop: '4px' }}
                  onChange={e => setSlotsPerDay(+e.target.value)} />
              </label>
            </div>

            {/* Preview grid */}
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                PREVIEW SLOTURI ({daysPerWeek} zile × {slotsPerDay} sloturi = {daysPerWeek * slotsPerDay} sloturi totale)
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Array.from({ length: daysPerWeek }, (_, d) => (
                  <div key={d} style={{ fontSize: '11px' }}>
                    <p style={{ ...lbl, marginBottom: '4px' }}>{DAY_NAMES[d]}</p>
                    {Array.from({ length: slotsPerDay }, (_, p) => (
                      <div key={p} style={{ padding: '2px 6px', borderRadius: '4px',
                        background: '#f3f4f6', color: '#374151', marginBottom: '2px', fontFamily: 'monospace' }}>
                        {d}-{p}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  await fetch('/api/resources/time-config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orgId, days_per_week: daysPerWeek, slots_per_day: slotsPerDay }),
                  })
                  toast.success('Configurare salvată')
                } catch { toast.error('Eroare la salvare') }
              }}
              style={{ marginTop: '20px', padding: '8px 18px', borderRadius: '8px', border: 'none',
                background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              Salvează configurarea
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Help panel ─────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div style={{ padding: '16px', borderRadius: '12px', background: '#f8faff',
          border: '0.5px solid #e0e7ff', fontSize: '12px', color: '#374151', lineHeight: '1.7' }}>
          <p style={{ fontWeight: 500, margin: '0 0 6px', color: '#4338ca', fontSize: '13px' }}>
            {help.title}
          </p>
          <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '12px' }}>{help.desc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {help.fields.map(f => (
              <div key={f.label}>
                <span style={{ fontWeight: 500, color: '#111827' }}>{f.label}</span>
                <span style={{ color: '#9ca3af' }}> — {f.hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
