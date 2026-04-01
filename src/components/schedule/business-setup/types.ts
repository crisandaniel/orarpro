// business-setup/types.ts
// Tipuri și constante pentru BusinessSetupClient.

export interface BusinessSoftRules {
  balanceHours: boolean
  avoidNightWeekend: boolean
  respectPreferences: boolean
  consecutiveDaysOff: boolean
  shiftContinuity: boolean
  weights: {
    balance: number       // 0-100
    nightWeekend: number
    preferences: number
    daysOff: number
    continuity: number
  }
}

export const DEFAULT_BUSINESS_SOFT_RULES: BusinessSoftRules = {
  balanceHours: true,
  avoidNightWeekend: true,
  respectPreferences: true,
  consecutiveDaysOff: true,
  shiftContinuity: false,
  weights: {
    balance: 90,
    nightWeekend: 70,
    preferences: 80,
    daysOff: 75,
    continuity: 40,
  },
}

export const HARD_RULES_BUSINESS = [
  'Un angajat max 1 tură pe zi',
  'Respectare unavailability per angajat',
  'Min repaus între ture (implicit 11h, UE)',
  'Max zile consecutive (implicit 6)',
  'Max ore/săptămână (implicit 48h, UE)',
  'Acoperire minimă per tură (slots_per_day)',
  'Angajații în concediu nu sunt asignați',
]

export const inp: React.CSSProperties = {
  border: '0.5px solid #d1d5db',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box' as const,
  background: '#fff',
  color: '#111827',
}