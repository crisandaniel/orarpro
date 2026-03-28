// src/lib/dal/schedules.ts
// Data Access Layer for schedules, shifts, assignments, constraints.

import { createAdminClient } from '@/lib/supabase/server'
import type { Schedule, ShiftDefinition, ShiftAssignment, Constraint, ScheduleShift } from '@/types'

export async function getSchedules(orgId: string): Promise<Schedule[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('schedules')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Schedule[]
}

export async function getSchedule(scheduleId: string): Promise<Schedule | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single()
  return data as Schedule ?? null
}

export async function getScheduleWithData(scheduleId: string, orgId: string) {
  const admin = createAdminClient()

  const [scheduleRes, assignmentsRes, scheduleShiftsRes, constraintsRes] = await Promise.all([
    admin.from('schedules').select('*').eq('id', scheduleId).eq('organization_id', orgId).single(),
    admin.from('shift_assignments')
      .select('*, employees(name,color), shift_definitions(name,color,start_time,end_time,shift_type)')
      .eq('schedule_id', scheduleId),
    admin.from('schedule_shifts')
      .select('shift_definition_id, slots_per_day, shift_definitions(*)')
      .eq('schedule_id', scheduleId),
    admin.from('constraints').select('*').eq('schedule_id', scheduleId).order('created_at'),
  ])

  const scheduleShifts = scheduleShiftsRes.data ?? []
  const shiftDefs = scheduleShifts.map((ss: any) => ss.shift_definitions).filter(Boolean) as ShiftDefinition[]

  return {
    schedule: scheduleRes.data as Schedule | null,
    assignments: (assignmentsRes.data ?? []) as any[],
    scheduleShifts,
    shiftDefs,
    constraints: (constraintsRes.data ?? []) as Constraint[],
  }
}
