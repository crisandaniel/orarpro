'use client'
// business-setup/SolverDebugLog.tsx
// Structură identică cu school-setup/SolverDebugLog.tsx:
//   - Sumar mereu vizibil (ture generate, status, timp)
//   - Buton Detalii → secțiuni pliabile
//   - "Asignări trimise" → info ture trimise la solver
//   - "Distribuție angajați" → per angajat, per tură, câte zile

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Employee } from '@/types'

interface ShiftInfo {
  id: string
  name: string
  color?: string
}

interface Props {
  debugLog:  any[]
  employees: Employee[]
  shiftDefs: ShiftInfo[]
}

export function BusinessSolverDebugLog({ debugLog, employees, shiftDefs }: Props) {
  const [showDebug, setShowDebug] = useState(false)

  if (!debugLog.length) return null

  const summary    = debugLog.find(e => e.type === 'summary')
  const status     = debugLog.find(e => e.type === 'solver_status')
  const shiftInfos = debugLog.filter(e => e.type === 'shift_info')
  const empResults = debugLog.filter(e => e.type === 'employee_result')

  const maxAssignments = Math.max(...empResults.map((e: any) => e.assignments ?? 0), 1)

  return (
    <div style={{ marginBottom: '24px', border: '0.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Sumar — mereu vizibil, identic cu school */}
      {summary && (
        <div style={{ padding: '12px 16px', background: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#374151' }}>
            <span>
              <strong style={{ color: summary.unfilled_slots > 0 ? '#dc2626' : '#059669' }}>
                {summary.filled_slots}/{summary.total_slots}
              </strong> ture generate
            </span>
            {status && (
              <span style={{ color: '#6b7280' }}>
                {status.status} în {status.time_seconds}s
              </span>
            )}
            {summary.unfilled_slots > 0 && (
              <span style={{ color: '#dc2626' }}>⚠ {summary.unfilled_slots} neacoperite</span>
            )}
          </div>
          <button onClick={() => setShowDebug(p => !p)}
            style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Detalii {showDebug ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}

      {/* Detalii pliabile — identic cu school */}
      {showDebug && (
        <div style={{ padding: '14px 16px', background: '#fff', fontSize: '12px' }}>

          {/* Asignări trimise — echivalent cu school */}
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Asignări trimise
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
            {shiftInfos.length > 0 ? shiftInfos.map((e: any, i: number) => (
              <p key={i} style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: '#374151' }}>
                <strong>{e.name}</strong> · {e.start_time ?? ''}–{e.end_time ?? ''} · {e.duration_h?.toFixed(1)}h · {e.slots_per_day} angajați/zi
                {e.shift_type === 'night' && <span style={{ color: '#7c3aed' }}> [noapte]</span>}
              </p>
            )) : (
              // Fallback: dacă shift_info lipsește, afișează shiftDefs
              shiftDefs.map((s, i) => (
                <p key={i} style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: '#374151' }}>
                  <strong>{s.name}</strong>
                </p>
              ))
            )}
          </div>

          {/* Distribuție angajați — echivalent cu "Distribuție profesori" din school */}
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Distribuție angajați
          </p>
          {empResults.map((e: any, i: number) => {
            const emp = employees.find(em => em.id === e.employee_id)
            const pct = Math.round((e.assignments / maxAssignments) * 100)
            const byShift = e.by_shift as Record<string, number> | undefined
            const shiftSummary = byShift
              ? shiftDefs
                  .filter(s => (byShift[s.id] ?? 0) > 0)
                  .map(s => `${s.name}: ${byShift[s.id]}z`)
                  .join(' · ')
              : ''
            return (
              <div key={i} style={{ marginBottom: '8px', padding: '6px 10px', borderRadius: '6px', background: '#f9fafb' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 500, color: '#111827', fontSize: '12px' }}>
                  {emp?.name ?? e.name}: {e.assignments} ture
                </p>
                {shiftSummary && (
                  <p style={{ margin: '0 0 4px', fontFamily: 'monospace', fontSize: '10px', color: '#9ca3af' }}>
                    {shiftSummary}
                  </p>
                )}
                <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: (emp as any)?.color ?? '#6366f1',
                    borderRadius: '2px', transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
