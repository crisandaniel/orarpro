// school-setup/types.ts
// Tipuri locale și constante pentru SchoolSetupClient.

import type { SoftRules } from '@/types'

export interface CellData {
  teacher_id:        string
  weekly_hours:      number
  lesson_pattern:    number[] | null
  preferred_room_id: string | null
}

export const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']

export const DEFAULT_SOFT_RULES: SoftRules = {
  avoidGapsForTeachers:       true,
  avoidLastHourForStages:     ['primary', 'middle'],
  avoidSameSubjectTwicePerDay: true,
  hardSubjectsMorning:         true,
  startFromFirstSlot:          true,
  weights: { teacherGaps: 80, lastHour: 60, sameSubject: 70, hardMorning: 50, startFirst: 90 },
}

export const inp: React.CSSProperties = {
  border: '0.5px solid #d1d5db', borderRadius: '8px', padding: '7px 10px',
  fontSize: '13px', width: '100%', boxSizing: 'border-box' as const,
  background: '#fff', color: '#111827',
}
