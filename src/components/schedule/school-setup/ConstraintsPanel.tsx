'use client'
// school-setup/ConstraintsPanel.tsx
// Tab-ul de constrângeri: hard (info) + soft (checkbox + slider 0-100).

import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { SoftRules } from '@/types'
import { DEFAULT_SOFT_RULES } from './types'

interface Props {
  softRules:        SoftRules
  onUpdateRule:     (key: keyof Omit<SoftRules, 'weights'>, value: any) => void
  onUpdateWeight:   (key: keyof SoftRules['weights'], value: number) => void
  onReset:          () => void
}

const HARD_RULES = [
  'Un profesor nu poate fi în două clase simultan',
  'O clasă nu poate avea două materii în același slot',
  'O sală nu poate fi ocupată de două clase simultan',
  'Ore duble plasate consecutive în aceeași zi',
  'Respectarea unavailable_slots per profesor',
  'Respectarea max_lessons_per_day/week per profesor',
  'Respectarea max_lessons_per_day per clasă',
  'Normă minimă (min_lessons_per_week) când e setată',
]

const SOFT_ITEMS = [
  { key: 'teacherGaps'  as const, toggle: 'avoidGapsForTeachers'       as const, label: 'Ferestre minime profesori',       hint: 'Evită orele libere între lecțiile unui profesor' },
  { key: 'lastHour'     as const, toggle: 'avoidLastHourForStages'      as const, label: 'Clase mici nu la ultima oră',      hint: 'Primar și gimnaziu evită ultima oră din zi' },
  { key: 'sameSubject'  as const, toggle: 'avoidSameSubjectTwicePerDay' as const, label: 'Evită aceeași materie de două ori/zi', hint: 'Max 1 oră din aceeași materie pe zi per clasă' },
  { key: 'hardMorning'  as const, toggle: 'hardSubjectsMorning'         as const, label: 'Materii grele dimineața',           hint: 'Matematică, fizică etc. în primele sloturi' },
  { key: 'startFirst'   as const, toggle: 'startFromFirstSlot'          as const, label: 'Orele încep de la primul slot',     hint: 'Clase fără ferestre la începutul zilei' },
]

export function ConstraintsPanel({ softRules, onUpdateRule, onUpdateWeight, onReset }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Hard rules */}
      <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#059669', margin: '0 0 8px',
          display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={14} /> Constrângeri hard (întotdeauna active)
        </p>
        {HARD_RULES.map(r => (
          <p key={r} style={{ fontSize: '12px', color: '#374151', margin: '2px 0', paddingLeft: '6px' }}>• {r}</p>
        ))}
      </div>

      {/* Soft rules */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0,
            display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} style={{ color: '#d97706' }} /> Constrângeri soft (weight 0–100)
          </p>
          <button onClick={onReset}
            style={{ fontSize: '11px', color: '#6b7280', background: 'none',
              border: '0.5px solid #d1d5db', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}>
            Reset defaults
          </button>
        </div>

        {SOFT_ITEMS.map(({ key, toggle, label, hint }) => {
          const enabled = !!(softRules as any)[toggle]
          const weight  = softRules.weights[key]
          return (
            <div key={key} style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px',
              background: enabled ? '#f9fafb' : '#fafafa',
              border: '0.5px solid #d1d5db', opacity: enabled ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabled}
                      onChange={e => onUpdateRule(toggle, e.target.checked)} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{label}</span>
                  </label>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 22px' }}>{hint}</p>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', minWidth: '32px', textAlign: 'right' }}>
                  {weight}
                </span>
              </div>
              <input type="range" min={0} max={100} value={weight} disabled={!enabled}
                onChange={e => onUpdateWeight(key, +e.target.value)}
                style={{ width: '100%', accentColor: '#2563eb' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
