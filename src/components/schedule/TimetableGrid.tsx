'use client'

// TimetableGrid — interactive school timetable display.
// Features:
// - Filter by class / teacher / room (first dropdown = entity selector)
// - Cards show subject + relevant context depending on filter mode
// - Stats bar shows solver type (greedy vs CP-SAT)
// - Export to PDF via print
// Used by: SchoolSetupClient (inline) + schedules/[id]/page.tsx

import { useState, useMemo } from 'react'
import { Printer } from 'lucide-react'

interface Teacher  { id: string; name: string; color: string }
interface Subject  { id: string; name: string; short_name: string; color: string }
interface Class    { id: string; name: string }
interface Room     { id: string; name: string }
interface Lesson {
  id: string
  teacher_id: string; subject_id: string; class_id: string
  room_id: string | null
  day: number; period: number; duration?: number
  school_teachers: { name: string; color: string } | null
  school_subjects: { name: string; short_name: string; color: string } | null
  school_classes:  { name: string } | null
  school_rooms:    { name: string } | null
}

interface Props {
  lessons: Lesson[]
  teachers: Teacher[]; subjects: Subject[]; classes: Class[]; rooms: Room[]
  periodsPerDay: number; periodDuration: number
  firstPeriodStart: string; workingDays: number[]
  scheduleId: string; locale: string
  solverUsed?: string   // 'greedy' | 'cp-sat (OPTIMAL)' | undefined
}

const DAY_NAMES = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum']

function getPeriodTime(firstStart: string, periodIdx: number, duration: number): string {
  const [h, m] = firstStart.split(':').map(Number)
  const startMins = h * 60 + m + periodIdx * (duration + 10)
  const endMins   = startMins + duration
  const fmt = (n: number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
  return `${fmt(startMins)}–${fmt(endMins)}`
}

type FilterMode = 'class' | 'teacher' | 'room'

export function TimetableGrid({
  lessons, teachers, subjects, classes, rooms,
  periodsPerDay, periodDuration, firstPeriodStart, workingDays,
  scheduleId, locale, solverUsed,
}: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('class')
  const [filterId, setFilterId]     = useState<string>(classes[0]?.id ?? '')

  const days = useMemo(() => {
    if (!workingDays || workingDays.length === 0) return [0,1,2,3,4]
    // Solver always generates day as 0-based (0=Mon, 1=Tue, ...)
    // workingDays from schedule may be 1-based ISO [1,2,3,4,5] or 0-based [0,1,2,3,4]
    // Always normalize to 0-based, then use as indices into lessons
    const maxVal = Math.max(...workingDays)
    const normalized = maxVal >= 7
      ? workingDays.map(d => d - 1)   // ISO 1-based → 0-based
      : [...workingDays]               // already 0-based
    // Return sorted 0-based day indices matching solver output
    return normalized.filter(d => d >= 0 && d <= 6).sort()
  }, [workingDays])

  const filterOptions: { id: string; name: string }[] =
    filterMode === 'class'   ? classes :
    filterMode === 'teacher' ? teachers : rooms

  // When switching mode, reset to first option
  function switchMode(mode: FilterMode) {
    setFilterMode(mode)
    const opts = mode === 'class' ? classes : mode === 'teacher' ? teachers : rooms
    setFilterId(opts[0]?.id ?? '')
  }

  const filtered = useMemo(() => {
    if (!filterId) return lessons
    if (filterMode === 'class')   return lessons.filter(l => l.class_id   === filterId)
    if (filterMode === 'teacher') return lessons.filter(l => l.teacher_id === filterId)
    if (filterMode === 'room')    return lessons.filter(l => l.room_id    === filterId)
    return lessons
  }, [lessons, filterMode, filterId])

  const grid = useMemo(() => {
    const map: Record<number, Record<number, Lesson[]>> = {}
    for (const l of filtered) {
      if (!map[l.day]) map[l.day] = {}
      if (!map[l.day][l.period]) map[l.day][l.period] = []
      map[l.day][l.period].push(l)
    }
    return map
  }, [filtered])

  const teacherWindows = useMemo(() => {
    let total = 0
    for (const t of teachers) {
      for (const day of days) {
        const busy = Array.from({ length: periodsPerDay }, (_, p) =>
          lessons.some(l => l.teacher_id === t.id && l.day === day && l.period === p)
        )
        let inLesson = false
        for (const b of busy) {
          if (inLesson && !b) total++
          if (b) inLesson = true
        }
      }
    }
    return total
  }, [lessons, teachers, days, periodsPerDay])

  const isGreedy = solverUsed === 'greedy'
  const solverLabel = !solverUsed ? null :
    isGreedy ? '⚡ Generat cu algoritm rapid (greedy)' :
    `✓ Generat cu CP-SAT solver (${solverUsed.replace('cp-sat (','').replace(')','').toLowerCase()})`

  const cellStyle = (hasLesson: boolean): React.CSSProperties => ({
    padding: '4px',
    verticalAlign: 'top',
    minWidth: '110px',
    minHeight: '52px',
    borderLeft: '0.5px solid #f0f0f0',
    borderBottom: '0.5px solid #f0f0f0',
    background: hasLesson ? '#fff' : '#fafafa',
  })

  return (
    <div>
      {/* Stats + solver badge */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: '#f9fafb', border: '0.5px solid #e5e7eb', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{lessons.length}</span> ore plasate
        </div>
        <div style={{ width: '1px', height: '14px', background: '#e5e7eb' }} />
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: teacherWindows > 0 ? '#d97706' : '#059669' }}>{teacherWindows}</span> ferestre profesori
        </div>
        <div style={{ width: '1px', height: '14px', background: '#e5e7eb' }} />
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{teachers.length}</span> prof · <span style={{ fontWeight: 500, color: '#111827' }}>{classes.length}</span> clase
        </div>
        {solverLabel && (
          <>
            <div style={{ width: '1px', height: '14px', background: '#e5e7eb' }} />
            <div style={{ fontSize: '12px', fontWeight: 500, color: isGreedy ? '#d97706' : '#059669' }}>
              {solverLabel}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        {/* PDF export button */}
        <button onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>
          <Printer style={{ width: '13px', height: '13px' }} />
          Export PDF
        </button>
      </div>

      {/* Filter controls — entity selector first, then mode toggle */}
      <div className="print-hide" style={{ overflowX: 'auto', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 'max-content' }}>
        {/* Entity selector — first, prominent */}
        <select value={filterId} onChange={e => setFilterId(e.target.value)}
          style={{ padding: '7px 10px', fontSize: '13px', borderRadius: '8px', border: '0.5px solid #d1d5db', color: '#111827', background: '#fff', cursor: 'pointer', minWidth: '160px' }}>
          <option value="">Toate</option>
          {filterOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid #e5e7eb' }}>
          {([['class','Clasă'],['teacher','Profesor'],['room','Sală']] as [FilterMode,string][]).map(([mode, label]) => (
            <button key={mode} onClick={() => switchMode(mode)}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: filterMode === mode ? '#2563eb' : '#fff',
                color: filterMode === mode ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '0.5px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', minWidth: '80px', borderBottom: '1px solid #e5e7eb' }}>
                Ora
              </th>
              {days.map(d => (
                <th key={d} style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #e5e7eb', borderLeft: '0.5px solid #f0f0f0' }}>
                  {DAY_NAMES[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, p) => (
              <tr key={p}>
                <td style={{ padding: '6px 12px', borderBottom: '0.5px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Ora {p + 1}</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>{getPeriodTime(firstPeriodStart, p, periodDuration)}</div>
                </td>

                {days.map(d => {
                  const cellLessons = grid[d]?.[p] ?? []
                  return (
                    <td key={d} style={cellStyle(cellLessons.length > 0)}>
                      {cellLessons.length === 0 ? (
                        <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#e5e7eb' }}>—</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {cellLessons.map(lesson => {
                            const subj    = lesson.school_subjects
                            const teacher = lesson.school_teachers
                            const cls     = lesson.school_classes
                            const room    = lesson.school_rooms
                            const color   = subj?.color ?? '#6366f1'
                            return (
                              <div key={lesson.id} style={{
                                padding: '4px 6px', borderRadius: '6px',
                                borderLeft: `3px solid ${color}`,
                                background: `${color}18`,
                              }}>
                                {/* Materie — mereu */}
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '1px', lineHeight: '1.3' }}>
                                  {subj?.short_name || subj?.name}
                                </div>
                                {/* Clasă — mereu */}
                                <div style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>
                                  {cls?.name}
                                </div>
                                {/* Profesor — mereu (util mai ales la view Clasă) */}
                                {teacher && (
                                  <div style={{ fontSize: '10px', color: '#6b7280' }}>{teacher.name}</div>
                                )}
                                {/* Sală — mereu dacă există */}
                                {room && (
                                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>{room.name}</div>
                                )}
                              </div>
                            )
                          })}
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

      {/* Legend */}
      {subjects.length > 0 && (
        <div className="print-hide" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {subjects.map(s => (
            <span key={s.id} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', borderLeft: `3px solid ${s.color}`, background: `${s.color}18`, color: '#374151' }}>
              {s.short_name || s.name}
            </span>
          ))}
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body * { visibility: hidden; }
          table, table * { visibility: visible; }
          table { position: absolute; left: 0; top: 0; width: 100%; font-size: 10px; }
        }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}