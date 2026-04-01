'use client'
// business-setup/ConstraintsPanel.tsx
// Structură identică cu school-setup/ConstraintsPanel.tsx
// Hard rules panel (verde) + Soft constraints cu checkbox + slider 0-100

import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { BusinessSoftRules } from './types'

interface Props {
  softRules:      BusinessSoftRules
  onUpdateRule:   (key: keyof Omit<BusinessSoftRules, 'weights'>, value: boolean) => void
  onUpdateWeight: (key: keyof BusinessSoftRules['weights'], value: number) => void
  onReset:        () => void
}

const HARD_RULES = [
  'Un angajat max 1 tură pe zi',
  'Angajat în concediu nu e asignat',
  'Respectarea unavailable_days / unavailable_dates per angajat',
  'Min repaus între ture consecutive (implicit 11h UE)',
  'Max zile consecutive fără zi liberă (implicit 6 UE)',
  'Max ore/săptămână (implicit 48h UE)',
  'Max ture de noapte/săptămână',
  'Acoperire minimă per tură (angajați/zi setați)',
]

const SOFT_ITEMS: {
  key:    keyof BusinessSoftRules['weights']
  toggle: keyof Omit<BusinessSoftRules, 'weights'>
  label:  string
  hint:   string
}[] = [
  { key: 'balance',     toggle: 'balanceHours',       label: 'Distribuție egală ore',                   hint: 'Angajații primesc un număr similar de ture pe săptămână' },
  { key: 'nightWeekend',toggle: 'avoidNightWeekend',   label: 'Evită ture de noapte vineri/sâmbătă',     hint: 'Penalizează asignarea turei de noapte la finalul săptămânii' },
  { key: 'preferences', toggle: 'respectPreferences',  label: 'Respectă preferințele angajaților',       hint: 'Ține cont de unavailable_slots marcate de angajați' },
  { key: 'daysOff',     toggle: 'consecutiveDaysOff',  label: 'Zile libere consecutive (weekend off)',   hint: 'Preferă să grupeze zilele libere consecutiv, nu dispersat' },
  { key: 'continuity',  toggle: 'shiftContinuity',     label: 'Continuitate tură (același shift zilnic)', hint: 'Minimizează schimbările de tură între zile consecutive' },
]

export function BusinessConstraintsPanel({ softRules, onUpdateRule, onUpdateWeight, onReset }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Hard rules — identic cu school */}
      <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#059669', margin: '0 0 8px',
          display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={14} /> Constrângeri hard (întotdeauna active)
        </p>
        {HARD_RULES.map(r => (
          <p key={r} style={{ fontSize: '12px', color: '#374151', margin: '2px 0', paddingLeft: '6px' }}>• {r}</p>
        ))}
      </div>

      {/* Soft rules — identic cu school */}
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
          const enabled = !!softRules[toggle]
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
