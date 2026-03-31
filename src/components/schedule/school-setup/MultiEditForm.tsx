'use client'
// school-setup/MultiEditForm.tsx
// Formular pentru editarea în bloc a mai multor celule din aceeași coloană (materie).
// Apare când utilizatorul face Ctrl+Click pe celule din tabelul curriculum.

import { useState } from 'react'
import type { CellData } from './types'

interface Props {
  firstCell:  CellData | undefined
  teachers:   { id: string; name: string }[]
  onApply:    (hours: number, pattern: number[] | null, teacherId: string) => void
}

export function MultiEditForm({ firstCell, teachers, onApply }: Props) {
  const [hours,      setHours]      = useState(firstCell?.weekly_hours ?? 0)
  const [patternStr, setPatternStr] = useState(firstCell?.lesson_pattern?.join(',') ?? '')
  const [teacherId,  setTeacherId]  = useState(firstCell?.teacher_id ?? '')

  const fieldStyle: React.CSSProperties = {
    border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '6px 8px',
    fontSize: '13px', width: '100%', boxSizing: 'border-box' as const,
    marginTop: '3px', background: '#fff', color: '#111827',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
      <label style={{ fontSize: '11px', color: '#6b7280' }}>
        Ore/săpt
        <input type="number" min={0} max={20} value={hours}
          onChange={e => setHours(+e.target.value)} style={fieldStyle} />
      </label>

      <label style={{ fontSize: '11px', color: '#6b7280' }}>
        Pattern (ex: 2,1,1)
        <input type="text" value={patternStr}
          placeholder={`implicit: ${Array(hours || 2).fill(1).join(',')}`}
          onChange={e => setPatternStr(e.target.value)} style={fieldStyle} />
      </label>

      <label style={{ fontSize: '11px', color: '#6b7280' }}>
        Profesor <span style={{ color: '#dc2626' }}>*</span>
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
          style={{ ...fieldStyle, cursor: 'pointer',
            borderColor: !teacherId ? '#fca5a5' : '#d1d5db' }}>
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
