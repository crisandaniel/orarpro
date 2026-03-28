'use client'

// ResourcesClient — CRUD for school resources.
// Edit pattern: optimistic local update + debounce 1.5s → single API call per field.
// Add: immediate DB insert, auto-focus new row.
// Delete: immediate, no confirmation.
// All DB via /api/resources (server-side admin client, no 401 issues).

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { SchoolResources, SchoolTeacher, SchoolSubject, SchoolClass, SchoolRoom, RoomType, SubjectDifficulty } from '@/types'

interface Props { orgId: string; initialResources: SchoolResources }
type Tab = 'teachers' | 'subjects' | 'rooms' | 'classes'

const COLORS = ['#6366f1','#2563eb','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777','#ea580c','#65a30d']
const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'classroom', label: 'Clasă' }, { value: 'lab', label: 'Laborator' },
  { value: 'gym', label: 'Sport' }, { value: 'amphitheater', label: 'Amfiteatru' },
  { value: 'seminar', label: 'Seminar' }, { value: 'workshop', label: 'Atelier' },
]

const inp: React.CSSProperties = { border: '0.5px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const rowStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: '0.5px solid #f3f4f6', alignItems: 'center', display: 'grid', gap: '8px' }
const headerStyle: React.CSSProperties = { padding: '6px 14px', borderBottom: '0.5px solid #e5e7eb', background: '#f9fafb', display: 'grid', gap: '8px', alignItems: 'center' }
const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }

// ── API ───────────────────────────────────────────────────────────────────────

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

// ── Help panel ────────────────────────────────────────────────────────────────

const HELP: Record<Tab, { title: string; desc: string; fields: { label: string; hint: string }[] }> = {
  teachers: {
    title: 'Profesori',
    desc: 'Definește toți profesorii instituției. Disponibili la orice orar nou — nu trebuie reintroduși per semestru.',
    fields: [
      { label: 'Nume', hint: 'Numele complet' },
      { label: 'Email', hint: 'Opțional — notificări viitoare' },
      { label: 'Max/zi', hint: 'Ore maxime pe zi (rec. 4-6)' },
      { label: 'Max/săpt', hint: 'Normă săptămânală (ex: 18)' },
      { label: 'Culoare', hint: 'Vizualizare în grilă' },
    ],
  },
  subjects: {
    title: 'Materii',
    desc: 'Materiile predate. Dificultatea influențează plasarea în orar — greu = dimineața.',
    fields: [
      { label: 'Materie', hint: 'Numele complet (ex: Matematică)' },
      { label: 'Scurt', hint: 'Prescurtare pentru grilă (ex: Mat)' },
      { label: 'Dificultate', hint: 'Greu = dimineața, ușor = oricând' },
      { label: 'Sală', hint: 'Tipul de sală necesar' },
    ],
  },
  rooms: {
    title: 'Săli',
    desc: 'Sălile disponibile. Generatorul atribuie automat sala potrivită tipului de materie.',
    fields: [
      { label: 'Sală', hint: 'Denumire (ex: Sala 101, Lab Chimie)' },
      { label: 'Tip', hint: 'Clasă, laborator, sport etc.' },
      { label: 'Capacitate', hint: 'Număr maxim de elevi' },
      { label: 'Corp', hint: 'Opțional — corp sau etaj' },
    ],
  },
  classes: {
    title: 'Clase',
    desc: 'Clasele sau seriile (universitate). Clasele cu grupe pot fi împărțite pentru seminare și laboratoare.',
    fields: [
      { label: 'Clasă', hint: 'Ex: 9A, 10B, Seria CTI' },
      { label: 'An', hint: 'Numărul anului (1-13 sau 1-4 uni)' },
      { label: 'Elevi', hint: 'Pentru potrivirea sălilor' },
      { label: 'Grupe', hint: 'Activează pentru seminare/lab' },
    ],
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResourcesClient({ orgId, initialResources }: Props) {
  const [tab, setTab]           = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<SchoolTeacher[]>(initialResources.teachers)
  const [subjects, setSubjects] = useState<SchoolSubject[]>(initialResources.subjects)
  const [classes,  setClasses]  = useState<SchoolClass[]>(initialResources.classes)
  const [rooms,    setRooms]    = useState<SchoolRoom[]>(initialResources.rooms)
  const [newRowId, setNewRowId] = useState<string | null>(null)
  const newRowRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (newRowId && newRowRef.current) {
      newRowRef.current.focus()
      newRowRef.current.select()
    }
  }, [newRowId])

  // Debounced save — 1.5s after last keystroke
  const debouncedUpdate = useDebounce(async (table: string, id: string, data: Record<string, unknown>) => {
    try { await apiUpdate(table, id, data) }
    catch (e: any) { toast.error(e.message) }
  }, 1500)

  // Immediate save for selects/checkboxes (no debounce needed — single event)
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
  const TABS = [
    { id: 'teachers' as Tab, label: `Profesori (${teachers.length})` },
    { id: 'subjects' as Tab, label: `Materii (${subjects.length})` },
    { id: 'rooms'    as Tab, label: `Săli (${rooms.length})` },
    { id: 'classes'  as Tab, label: `Clase (${classes.length})` },
  ]

  const delBtn = (onClick: () => void) => (
    <button onClick={onClick} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Trash2 style={{ width: '14px', height: '14px' }} />
    </button>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>

      {/* ── Left: table ───────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', marginBottom: '16px' }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => { setTab(id); setNewRowId(null) }}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                borderBottom: tab === id ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === id ? '#1d4ed8' : '#6b7280', marginBottom: '-1px' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>

          {/* Teachers */}
          {tab === 'teachers' && (
            <>
              <div style={{ ...headerStyle, gridTemplateColumns: '1fr 1fr 60px 70px 36px 32px' }}>
                {['Nume','Email','Max/zi','Max/săpt','Culoare',''].map(h => <span key={h} style={lbl}>{h}</span>)}
              </div>
              {teachers.length === 0 && <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Niciun profesor.</p>}
              {teachers.map(t => (
                <div key={t.id} style={{ ...rowStyle, gridTemplateColumns: '1fr 1fr 60px 70px 36px 32px' }}>
                  <input ref={t.id === newRowId ? newRowRef : undefined}
                    value={t.name} placeholder={t.id === newRowId ? 'ex: Ion Popescu' : ''} style={inp}
                    onChange={e => { setTeachers(p => p.map(x => x.id===t.id ? {...x,name:e.target.value} : x)); debouncedUpdate('school_teachers', t.id, { name: e.target.value }) }} />
                  <input value={t.email ?? ''} placeholder="email@scoala.ro" style={inp}
                    onChange={e => { setTeachers(p => p.map(x => x.id===t.id ? {...x,email:e.target.value||null} : x)); debouncedUpdate('school_teachers', t.id, { email: e.target.value || null }) }} />
                  <input type="number" min={1} max={12} value={t.max_periods_per_day} style={inp}
                    onChange={e => { setTeachers(p => p.map(x => x.id===t.id ? {...x,max_periods_per_day:+e.target.value} : x)); debouncedUpdate('school_teachers', t.id, { max_periods_per_day: +e.target.value }) }} />
                  <input type="number" min={1} max={40} value={t.max_periods_per_week} style={inp}
                    onChange={e => { setTeachers(p => p.map(x => x.id===t.id ? {...x,max_periods_per_week:+e.target.value} : x)); debouncedUpdate('school_teachers', t.id, { max_periods_per_week: +e.target.value }) }} />
                  <input type="color" value={t.color} style={{ width: '36px', height: '36px', border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
                    onChange={e => { setTeachers(p => p.map(x => x.id===t.id ? {...x,color:e.target.value} : x)); immediateUpdate('school_teachers', t.id, { color: e.target.value }) }} />
                  {delBtn(() => removeRow('school_teachers', t.id, setTeachers))}
                </div>
              ))}
              <div style={{ padding: '10px 14px' }}>
                <button onClick={() => addRow('school_teachers', { name: '', email: null, max_periods_per_day: 6, max_periods_per_week: 20, color: COLORS[teachers.length % COLORS.length] }, setTeachers)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Adaugă profesor
                </button>
              </div>
            </>
          )}

          {/* Subjects */}
          {tab === 'subjects' && (
            <>
              <div style={{ ...headerStyle, gridTemplateColumns: '2fr 80px 1fr 1fr 36px 32px' }}>
                {['Materie','Scurt','Dificultate','Sală necesară','Culoare',''].map(h => <span key={h} style={lbl}>{h}</span>)}
              </div>
              {subjects.length === 0 && <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Nicio materie.</p>}
              {subjects.map(s => (
                <div key={s.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 80px 1fr 1fr 36px 32px' }}>
                  <input ref={s.id === newRowId ? newRowRef : undefined}
                    value={s.name} placeholder={s.id === newRowId ? 'ex: Matematică' : ''} style={inp}
                    onChange={e => { setSubjects(p => p.map(x => x.id===s.id ? {...x,name:e.target.value} : x)); debouncedUpdate('school_subjects', s.id, { name: e.target.value }) }} />
                  <input value={s.short_name ?? ''} placeholder="Mat" style={inp}
                    onChange={e => { setSubjects(p => p.map(x => x.id===s.id ? {...x,short_name:e.target.value} : x)); debouncedUpdate('school_subjects', s.id, { short_name: e.target.value }) }} />
                  <select value={s.difficulty} style={sel}
                    onChange={e => { const v=e.target.value as SubjectDifficulty; setSubjects(p => p.map(x => x.id===s.id ? {...x,difficulty:v} : x)); immediateUpdate('school_subjects', s.id, { difficulty: v }) }}>
                    <option value="hard">Greu</option><option value="medium">Mediu</option><option value="easy">Ușor</option>
                  </select>
                  <select value={s.required_room_type} style={sel}
                    onChange={e => { const v=e.target.value as RoomType; setSubjects(p => p.map(x => x.id===s.id ? {...x,required_room_type:v} : x)); immediateUpdate('school_subjects', s.id, { required_room_type: v }) }}>
                    {ROOM_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <input type="color" value={s.color} style={{ width: '36px', height: '36px', border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
                    onChange={e => { setSubjects(p => p.map(x => x.id===s.id ? {...x,color:e.target.value} : x)); immediateUpdate('school_subjects', s.id, { color: e.target.value }) }} />
                  {delBtn(() => removeRow('school_subjects', s.id, setSubjects))}
                </div>
              ))}
              <div style={{ padding: '10px 14px' }}>
                <button onClick={() => addRow('school_subjects', { name: '', short_name: '', color: COLORS[subjects.length % COLORS.length], difficulty: 'medium', required_room_type: 'classroom' }, setSubjects)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Adaugă materie
                </button>
              </div>
            </>
          )}

          {/* Rooms */}
          {tab === 'rooms' && (
            <>
              <div style={{ ...headerStyle, gridTemplateColumns: '2fr 1fr 80px 1fr 32px' }}>
                {['Sală','Tip','Capacitate','Corp/etaj',''].map(h => <span key={h} style={lbl}>{h}</span>)}
              </div>
              {rooms.length === 0 && <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Nicio sală.</p>}
              {rooms.map(r => (
                <div key={r.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 1fr 80px 1fr 32px' }}>
                  <input ref={r.id === newRowId ? newRowRef : undefined}
                    value={r.name} placeholder={r.id === newRowId ? 'ex: Sala 101' : ''} style={inp}
                    onChange={e => { setRooms(p => p.map(x => x.id===r.id ? {...x,name:e.target.value} : x)); debouncedUpdate('school_rooms', r.id, { name: e.target.value }) }} />
                  <select value={r.room_type} style={sel}
                    onChange={e => { const v=e.target.value as RoomType; setRooms(p => p.map(x => x.id===r.id ? {...x,room_type:v} : x)); immediateUpdate('school_rooms', r.id, { room_type: v }) }}>
                    {ROOM_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                  </select>
                  <input type="number" min={1} value={r.capacity} style={inp}
                    onChange={e => { setRooms(p => p.map(x => x.id===r.id ? {...x,capacity:+e.target.value} : x)); debouncedUpdate('school_rooms', r.id, { capacity: +e.target.value }) }} />
                  <input value={r.building ?? ''} placeholder="Corp A" style={inp}
                    onChange={e => { setRooms(p => p.map(x => x.id===r.id ? {...x,building:e.target.value||null} : x)); debouncedUpdate('school_rooms', r.id, { building: e.target.value || null }) }} />
                  {delBtn(() => removeRow('school_rooms', r.id, setRooms))}
                </div>
              ))}
              <div style={{ padding: '10px 14px' }}>
                <button onClick={() => addRow('school_rooms', { name: '', room_type: 'classroom', capacity: 30, building: null }, setRooms)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Adaugă sală
                </button>
              </div>
            </>
          )}

          {/* Classes */}
          {tab === 'classes' && (
            <>
              <div style={{ ...headerStyle, gridTemplateColumns: '2fr 80px 80px auto 32px' }}>
                {['Clasă/Serie','An','Nr. elevi','Grupe',''].map(h => <span key={h} style={lbl}>{h}</span>)}
              </div>
              {classes.length === 0 && <p style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Nicio clasă.</p>}
              {classes.map(c => (
                <div key={c.id} style={{ ...rowStyle, gridTemplateColumns: '2fr 80px 80px auto 32px' }}>
                  <input ref={c.id === newRowId ? newRowRef : undefined}
                    value={c.name} placeholder={c.id === newRowId ? 'ex: 9A' : ''} style={inp}
                    onChange={e => { setClasses(p => p.map(x => x.id===c.id ? {...x,name:e.target.value} : x)); debouncedUpdate('school_classes', c.id, { name: e.target.value }) }} />
                  <input type="number" min={1} max={13} value={c.year} style={inp}
                    onChange={e => { setClasses(p => p.map(x => x.id===c.id ? {...x,year:+e.target.value} : x)); debouncedUpdate('school_classes', c.id, { year: +e.target.value }) }} />
                  <input type="number" min={1} value={c.student_count} style={inp}
                    onChange={e => { setClasses(p => p.map(x => x.id===c.id ? {...x,student_count:+e.target.value} : x)); debouncedUpdate('school_classes', c.id, { student_count: +e.target.value }) }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={c.has_groups}
                      onChange={e => { const v=e.target.checked; setClasses(p => p.map(x => x.id===c.id ? {...x,has_groups:v} : x)); immediateUpdate('school_classes', c.id, { has_groups: v }) }} />
                    Are grupe
                  </label>
                  {delBtn(() => removeRow('school_classes', c.id, setClasses))}
                </div>
              ))}
              <div style={{ padding: '10px 14px' }}>
                <button onClick={() => addRow('school_classes', { name: '', year: 9, student_count: 30, has_groups: false }, setClasses)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Adaugă clasă
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Right: help panel ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '44px' }}>
        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>{help.title}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>{help.desc}</p>
        </div>
        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #e5e7eb' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Câmpuri</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {help.fields.map(({ label, hint }) => (
              <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>{hint}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '10px 12px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
            Modificările se salvează automat după 1.5s de pauză. Selecțiile și culorile se salvează imediat.
          </p>
        </div>
      </div>

    </div>
  )
}