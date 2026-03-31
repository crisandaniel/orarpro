'use client'
// school-setup/SolverDebugLog.tsx
// Afișează sumar solver + detalii pliabile (asignări, distribuție profesori).

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { DAY_NAMES } from './types'
import type { SchoolTeacher, SchoolSubject, SchoolClass } from '@/types'

interface Props {
  debugLog: any[]
  teachers: SchoolTeacher[]
  subjects: SchoolSubject[]
  classes:  SchoolClass[]
}

export function SolverDebugLog({ debugLog, teachers, subjects, classes }: Props) {
  const [showDebug, setShowDebug] = useState(false)

  if (!debugLog.length) return null

  const summary = debugLog.find(e => e.type === 'summary')
  const status  = debugLog.find(e => e.type === 'solver_status')

  return (
    <div style={{ marginBottom: '24px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Sumar — mereu vizibil */}
      {summary && (
        <div style={{ padding: '12px 16px', background: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#374151' }}>
            <span>
              <strong style={{ color: summary.violations > 0 ? '#dc2626' : '#059669' }}>
                {summary.scheduled}/{summary.total}
              </strong> ore generate
            </span>
            {status && (
              <span style={{ color: '#6b7280' }}>
                {status.status} în {status.time_seconds}s
              </span>
            )}
            {summary.violations > 0 && (
              <span style={{ color: '#dc2626' }}>⚠ {summary.violations} probleme</span>
            )}
          </div>
          <button onClick={() => setShowDebug(p => !p)}
            style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Detalii {showDebug ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </div>
      )}

      {/* Detalii pliabile */}
      {showDebug && (
        <div style={{ padding: '14px 16px', background: '#fff', fontSize: '12px' }}>
          {/* Assignments */}
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Asignări trimise
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
            {debugLog.filter(e => e.type === 'assignment').map((e, i) => {
              const t = teachers.find(t => t.id === e.teacher_id)
              const s = subjects.find(s => s.id === e.subject_id)
              const c = classes.find(c => c.id === e.class_id)
              return (
                <p key={i} style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: '#374151' }}>
                  {t?.name ?? e.teacher_id?.slice(0,8)} → <strong>{s?.name ?? e.subject_id?.slice(0,8)}</strong> → {c?.name ?? e.class_id?.slice(0,8)} × {e.weekly_hours}h{e.lesson_pattern ? ` [${e.lesson_pattern.join(',')}]` : ''}
                </p>
              )
            })}
          </div>

          {/* Per-teacher results */}
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Distribuție profesori
          </p>
          {debugLog.filter(e => e.type === 'teacher_result').map((e, i) => {
            const t = teachers.find(t => t.id === e.teacher_id)
            const slotsStr = (e.slots ?? [])
              .map((s: number[]) => `${DAY_NAMES[s[0]]}:S${s[1]+1}`)
              .join(' · ')
            return (
              <div key={i} style={{ marginBottom: '6px', padding: '6px 10px', borderRadius: '6px',
                background: e.conflict ? '#fef2f2' : '#f9fafb' }}>
                <p style={{ margin: '0 0 2px', fontWeight: 500,
                  color: e.conflict ? '#dc2626' : '#111827', fontSize: '12px' }}>
                  {t?.name ?? e.teacher_id?.slice(0,8)}: {e.lessons} lecții
                  {e.conflict && <span style={{ color: '#dc2626' }}> ⚠ CONFLICT</span>}
                </p>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '10px', color: '#9ca3af' }}>
                  {slotsStr}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
