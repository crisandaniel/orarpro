'use client'

// TimetableGrid — interactive school timetable display.
// Layout: periods (rows) × days (cols).
// Filters: by class, teacher, or room.
// Color-coded by subject.
// Used by: schedules/[id]/timetable/page.tsx

import { useState, useMemo } from 'react'

interface Teacher  { id: string; name: string; color: string }
interface Subject  { id: string; name: string; short_name: string; color: string }
interface Class    { id: string; name: string }
interface Room     { id: string; name: string }
interface Lesson {
  id: string
  teacher_id: string; subject_id: string; class_id: string
  group_id: string | null; room_id: string | null
  day: number; period: number
  school_teachers: { name: string; color: string }
  school_subjects: { name: string; short_name: string; color: string }
  school_classes:  { name: string }
  school_groups:   { name: string } | null
  school_rooms:    { name: string } | null
}

interface Props {
  lessons: Lesson[]
  teachers: Teacher[]; subjects: Subject[]; classes: Class[]; rooms: Room[]
  periodsPerDay: number; periodDuration: number
  firstPeriodStart: string; workingDays: number[]
  scheduleId: string; locale: string
}

const DAY_NAMES = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum']

function getPeriodTime(firstStart: string, periodIdx: number, duration: number): string {
  const [h, m] = firstStart.split(':').map(Number)
  const startMins = h * 60 + m + periodIdx * (duration + 10)
  const endMins   = startMins + duration
  const fmt = (n: number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
  return `${fmt(startMins)}–${fmt(endMins)}`
}

export function TimetableGrid({
  lessons, teachers, subjects, classes, rooms,
  periodsPerDay, periodDuration, firstPeriodStart, workingDays, scheduleId, locale,
}: Props) {
  type FilterMode = 'class' | 'teacher' | 'room'
  const [filterMode, setFilterMode] = useState<FilterMode>('class')
  const [filterId, setFilterId]     = useState<string>(classes[0]?.id ?? '')

  // Days: convert working_days (1=Mon) to 0-based indices
  const days = useMemo(() =>
    workingDays.map(d => d - 1).filter(d => d >= 0 && d <= 6),
  [workingDays])

  // Filter lessons based on current filter
  const filtered = useMemo(() => {
    if (!filterId) return lessons
    if (filterMode === 'class')   return lessons.filter(l => l.class_id   === filterId)
    if (filterMode === 'teacher') return lessons.filter(l => l.teacher_id === filterId)
    if (filterMode === 'room')    return lessons.filter(l => l.room_id    === filterId)
    return lessons
  }, [lessons, filterMode, filterId])

  // Build lookup: day → period → lessons[]
  const grid = useMemo(() => {
    const map: Record<number, Record<number, Lesson[]>> = {}
    for (const l of filtered) {
      if (!map[l.day]) map[l.day] = {}
      if (!map[l.day][l.period]) map[l.day][l.period] = []
      map[l.day][l.period].push(l)
    }
    return map
  }, [filtered])

  const filterOptions = filterMode === 'class'   ? classes
                      : filterMode === 'teacher' ? teachers
                      : rooms

  // Stats
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
      {/* Stats bar */}
      <div className="print-hide flex items-center gap-4 mb-4 p-3 rounded-xl"
        style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{lessons.length}</span> ore plasate
        </div>
        <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: teacherWindows > 0 ? '#d97706' : '#059669' }}>{teacherWindows}</span> ferestre profesori
        </div>
        <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{teachers.length}</span> profesori · <span style={{ fontWeight: 500, color: '#111827' }}>{classes.length}</span> clase
        </div>
      </div>

      {/* Filter controls */}
      <div className="print-hide flex items-center gap-3 mb-4">
        {/* Mode toggle */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid #e5e7eb' }}>
          {([['class','Clasă'],['teacher','Profesor'],['room','Sală']] as [FilterMode,string][]).map(([mode, label]) => (
            <button key={mode} onClick={() => { setFilterMode(mode); setFilterId(filterOptions[0]?.id ?? '') }}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: filterMode === mode ? '#2563eb' : '#fff',
                color: filterMode === mode ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Entity selector */}
        <select value={filterId} onChange={e => setFilterId(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '8px', border: '0.5px solid #d1d5db', color: '#111827', background: '#fff', cursor: 'pointer' }}>
          <option value="">Toate</option>
          {filterOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
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
                {/* Period label */}
                <td style={{ padding: '6px 12px', borderBottom: '0.5px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Ora {p + 1}</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>{getPeriodTime(firstPeriodStart, p, periodDuration)}</div>
                </td>

                {/* Day cells */}
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
                            const subj = lesson.school_subjects
                            const teacher = lesson.school_teachers
                            const cls = lesson.school_classes
                            const group = lesson.school_groups
                            const room = lesson.school_rooms
                            const color = subj?.color ?? '#6366f1'
                            // Darken for text
                            return (
                              <div key={lesson.id} style={{
                                padding: '4px 6px', borderRadius: '6px', borderLeft: `3px solid ${color}`,
                                background: `${color}18`, // very light tint
                              }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '1px' }}>
                                  {subj?.short_name ?? subj?.name}
                                </div>
                                {filterMode !== 'teacher' && (
                                  <div style={{ fontSize: '10px', color: '#6b7280' }}>{teacher?.name}</div>
                                )}
                                {filterMode !== 'class' && (
                                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                    {cls?.name}{group ? ` / ${group.name}` : ''}
                                  </div>
                                )}
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
        <div className="print-hide flex flex-wrap gap-2 mt-4">
          {subjects.map(s => (
            <span key={s.id} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', borderLeft: `3px solid ${s.color}`, background: `${s.color}18`, color: '#374151' }}>
              {s.short_name || s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
