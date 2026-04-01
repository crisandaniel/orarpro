// src/app/[locale]/(dashboard)/schedules/[id]/business-setup/page.tsx
// Server component — identic cu school-setup/page.tsx ca pattern.
// Încarcă: schedule, employees, shiftDefs (cu slots_per_day), initialAssignments cu joins.

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { BusinessSetupClient } from '@/components/schedule/BusinessSetupClient'
import { getHolidaysInRange } from '@/lib/holidays'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

export default async function BusinessSetupPage({ params }: Props) {
  const { id, locale } = await params
  const lp = (p: string) => locale === 'ro' ? p : `/${locale}${p}`

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(lp('/login'))

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(lp('/setup'))

  const admin = createAdminClient()

  const { data: schedule } = await admin
    .from('schedules')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .single()

  if (!schedule) notFound()
  if (schedule.type !== 'shifts') redirect(lp(`/schedules/${id}/school-setup`))

  const { data: employees } = await admin
    .from('employees')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .order('name')

  // Fetch shift definitions cu slots_per_day
  // FĂRĂ .order('created_at') — coloana nu există în schedule_shifts
  const { data: scheduleShifts, error: ssErr } = await admin
    .from('schedule_shifts')
    .select('id, slots_per_day, shift_definitions(*)')
    .eq('schedule_id', id)


  // shift_definitions(*) returnează array în Supabase — luăm primul element
  const shiftDefs = (scheduleShifts ?? []).map((ss: any) => {
    const def = Array.isArray(ss.shift_definitions) ? ss.shift_definitions[0] : ss.shift_definitions
      return def ? { ...def, slots_per_day: ss.slots_per_day ?? 1 } : null
  }).filter(Boolean)


  // Fetch asignări existente cu joins — identic cu school getLessons
  const { data: assignments } = await admin
    .from('shift_assignments')
    .select('*, employees(name,color), shift_definitions(name,color,start_time,end_time,shift_type)')
    .eq('schedule_id', id)

  const holidays = await getHolidaysInRange(
    schedule.country_code, schedule.start_date, schedule.end_date
  )

  return (
    <BusinessSetupClient
      schedule={schedule as any}
      employees={(employees ?? []) as any}
      shiftDefs={shiftDefs as any}
      initialAssignments={assignments ?? []}
      locale={locale}
      holidays={holidays}
      existingGenerationConfig={(schedule as any).generation_config ?? null}
    />
  )
}