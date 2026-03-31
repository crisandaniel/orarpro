'use client'
// school-setup/CurriculumMatrix.tsx
// Tabelul clasă×materie cu popovers per celulă și multi-select Ctrl+Click.

import type { SchoolTeacher, SchoolSubject, SchoolClass, SchoolRoom } from '@/types'
import type { CellData } from './types'
import { inp } from './types'

interface Props {
  classes:        SchoolClass[]
  subjects:       SchoolSubject[]
  teachers:       SchoolTeacher[]
  rooms:          SchoolRoom[]
  matrix:         Record<string, Record<string, CellData>>
  activeCell:     { classId: string; subjectId: string } | null
  selectedCells:  Set<string>
  multiSubjectId: string | null
  onCellClick:    (e: React.MouseEvent, classId: string, subjectId: string) => void
  onSetCell:      (classId: string, subjectId: string, data: CellData | null) => void
  onClosePopover: () => void
}

export function CurriculumMatrix({
  classes, subjects, teachers, rooms, matrix,
  activeCell, selectedCells, multiSubjectId,
  onCellClick, onSetCell, onClosePopover,
}: Props) {
  if (classes.length === 0 || subjects.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af', padding: '32px',
        textAlign: 'center', border: '0.5px dashed #e5e7eb', borderRadius: '12px' }}>
        Adaugă clase și materii în <strong>Resurse</strong> înainte.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 10px', background: '#f9fafb', border: '0.5px solid #d1d5db',
              fontWeight: 500, color: '#374151', textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, fontSize: '12px', whiteSpace: 'nowrap' as const }}>
              Clasă
            </th>
            {subjects.map(s => (
              <th key={s.id} style={{ padding: '8px 10px', background: '#f9fafb', border: '0.5px solid #d1d5db',
                fontWeight: 500, color: '#374151', textAlign: 'center', minWidth: '64px', fontSize: '11px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.short_name ?? s.name}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id}>
              <td style={{ padding: '5px 8px', border: '0.5px solid #d1d5db', fontWeight: 500,
                color: '#111827', background: '#f9fafb', position: 'sticky', left: 0, fontSize: '12px', whiteSpace: 'nowrap' as const }}>
                {cls.name}
              </td>
              {subjects.map(subj => {
                const cell          = matrix[cls.id]?.[subj.id]
                const isActive      = activeCell?.classId === cls.id && activeCell?.subjectId === subj.id
                const isSelected    = selectedCells.has(`${cls.id}|${subj.id}`)
                const missingTeacher = cell && cell.weekly_hours > 0 && !cell.teacher_id
                return (
                  <td key={subj.id} style={{ padding: '2px', border: '0.5px solid #d1d5db',
                    textAlign: 'center', position: 'relative' }}>
                    <button
                      onClick={e => onCellClick(e, cls.id, subj.id)}
                      style={{ width: '100%', minWidth: '60px', padding: '4px 2px',
                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                        background: cell ? subj.color + '22' : isSelected ? '#eff6ff' : 'transparent',
                        outline: isActive ? `2px solid ${subj.color}` : isSelected ? '2px solid #2563eb' : missingTeacher ? '2px solid #fca5a5' : 'none' }}>
                      {cell ? (
                        <div>
                          <span style={{ fontWeight: 600, color: '#111827', fontSize: '11px' }}>{cell.weekly_hours}h</span>
                          {cell.lesson_pattern && (
                            <span style={{ fontSize: '9px', color: '#6b7280', display: 'block' }}>
                              [{cell.lesson_pattern.join(',')}]
                            </span>
                          )}
                          {cell.teacher_id ? (
                            <span style={{ fontSize: '9px', color: '#6b7280', display: 'block',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {teachers.find(t => t.id === cell.teacher_id)?.name}
                            </span>
                          ) : (
                            <span style={{ fontSize: '9px', color: '#dc2626', display: 'block' }}>⚠</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: '13px' }}>+</span>
                      )}
                    </button>

                    {/* Popover */}
                    {isActive && (
                      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 50, background: '#fff', border: '0.5px solid #d1d5db', borderRadius: '12px',
                        padding: '14px', width: '220px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                        <p style={{ fontSize: '11px', fontWeight: 500, color: '#374151', margin: '0 0 10px' }}>
                          {cls.name} · {subj.name}
                        </p>

                        <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                          Ore/săpt
                          <input type="number" min={0} max={20} value={cell?.weekly_hours ?? 0}
                            onChange={e => {
                              const n = +e.target.value
                              if (n === 0) onSetCell(cls.id, subj.id, null)
                              else onSetCell(cls.id, subj.id, {
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
                            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                              Pattern ore (ex: 2,1 pentru bloc dublu)
                              <input placeholder={`implicit: ${Array(cell.weekly_hours).fill(1).join(',')}`}
                                value={cell.lesson_pattern?.join(',') ?? ''}
                                onChange={e => {
                                  const raw = e.target.value
                                  const pattern = raw ? raw.split(',').map(Number).filter(n => n > 0) : null
                                  onSetCell(cls.id, subj.id, { ...cell, lesson_pattern: pattern })
                                }}
                                style={{ ...inp, marginTop: '3px' }} />
                            </label>

                            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                              Profesor <span style={{ color: '#dc2626' }}>*</span>
                              <select value={cell.teacher_id ?? ''}
                                onChange={e => onSetCell(cls.id, subj.id, { ...cell, teacher_id: e.target.value })}
                                style={{ ...inp, marginTop: '3px', borderColor: !cell.teacher_id ? '#fca5a5' : '#d1d5db' }}>
                                <option value="">— selectează —</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </label>

                            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '10px' }}>
                              Sală preferată
                              <select value={cell.preferred_room_id ?? ''}
                                onChange={e => onSetCell(cls.id, subj.id, { ...cell, preferred_room_id: e.target.value || null })}
                                style={{ ...inp, marginTop: '3px' }}>
                                <option value="">— fără preferință —</option>
                                {rooms
                                  .filter(r => !subj.required_room_type || r.type === subj.required_room_type)
                                  .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </label>
                          </>
                        )}

                        <button onClick={() => { onSetCell(cls.id, subj.id, null); onClosePopover() }}
                          style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
  )
}