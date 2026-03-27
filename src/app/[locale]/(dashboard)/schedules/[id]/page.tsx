// Schedule view — loads data server-side, renders grid + actions.
// Used by: schedule list and end of wizard flow.

import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getHolidaysInRange } from '@/lib/holidays'
import { format } from 'date-fns'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { ScheduleActions } from '@/components/schedule/ScheduleActions'
import { AISuggestionsPanel } from '@/components/schedule/AISuggestionsPanel'
import { ConstraintsPanel } from '@/components/schedule/ConstraintsPanel'
import { EmployeeStats } from '@/components/schedule/EmployeeStats'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

export default async function ScheduleViewPage({ params }: Props) {
  const { id, locale } = await params
  const supabase = await createServerSupabaseClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: schedule, error } = await admin
    .from('schedules').select('*').eq('id', id).single()
  if (error || !schedule) notFound()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id').eq('user_id', user.id).single()

  const [assignmentsResult, scheduleShiftsResult, employeesResult, constraintsResult] = await Promise.all([
    admin.from('shift_assignments')
      .select('*, employees(name,color), shift_definitions(name,color,start_time,end_time,shift_type)')
      .eq('schedule_id', id),
    admin.from('schedule_shifts')
      .select('shift_definition_id, slots_per_day, shift_definitions(*)')
      .eq('schedule_id', id),
    admin.from('employees')
      .select('*')
      .eq('organization_id', membership?.organization_id ?? '')
      .eq('is_active', true)
      .order('name'),
    admin.from('constraints')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at'),
  ])

  const scheduleShifts = scheduleShiftsResult.data ?? []
  const shiftDefs = scheduleShifts.map((ss: any) => ss.shift_definitions).filter(Boolean)
  const constraints = constraintsResult.data ?? []
  const generationConfig = (schedule.generation_config as any) ?? {}

  // Always load holidays for visual display on the grid.
  // include_holidays flag only affects generation, not visual marking.
  const holidays = await getHolidaysInRange(
    schedule.country_code, schedule.start_date, schedule.end_date
  )

  const employeeCount = employeesResult.data?.length ?? 0
  const aiSuggestions = schedule.ai_suggestions as any[] | null

  return (
    <div className="max-w-full">
      {/* Header — hidden during print */}
      <div className="flex items-start justify-between mb-6 print-hide">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{schedule.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            {format(new Date(schedule.start_date), 'd MMM')} –{' '}
            {format(new Date(schedule.end_date), 'd MMM yyyy')}
            {' · '}{employeeCount} {employeeCount === 1 ? 'angajat' : 'angajați'}
          </p>
        </div>
        <ScheduleActions scheduleId={id} status={schedule.status} locale={locale} />
      </div>

      {/* Print-only title */}
      <div className="print-only" style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{schedule.name}</h1>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
          {format(new Date(schedule.start_date), 'd MMM yyyy')} –{' '}
          {format(new Date(schedule.end_date), 'd MMM yyyy')}
          {' · '}{employeeCount} angajați
        </p>
      </div>

      {shiftDefs.length === 0 && (
        <div className="mb-4 p-4 rounded-xl text-sm print-hide flex items-center justify-between"
          style={{ background: '#fffbeb', border: '0.5px solid #fde68a', color: '#92400e' }}>
          <span>⚠️ Nicio tură definită pentru acest orar.</span>
          <Link
            href={`/${locale}/schedules/${id}/setup`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: '#d97706' }}
          >
            Configurează turele →
          </Link>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <ScheduleGrid
            schedule={schedule as any}
            assignments={(assignmentsResult.data ?? []) as any}
            employees={(employeesResult.data ?? []) as any}
            shiftDefinitions={shiftDefs as any}
            holidays={holidays}
            scheduleId={id}
          />
        </div>

        {aiSuggestions && aiSuggestions.length > 0 && (
          <div className="w-72 shrink-0 print-hide">
            <AISuggestionsPanel suggestions={aiSuggestions} />
          </div>
        )}
      </div>

      {/* Employee statistics panel */}
      <div className="print-hide">
        <EmployeeStats
          employees={(employeesResult.data ?? []) as any}
          assignments={(assignmentsResult.data ?? []) as any}
          shiftDefinitions={shiftDefs as any}
          schedule={schedule as any}
        />
      </div>

      {/* Editable constraints panel */}
      <div className="print-hide">
        <ConstraintsPanel
          scheduleId={id}
          schedule={schedule as any}
          initialConstraints={constraints as any}
          employees={(employeesResult.data ?? []) as any}
          shiftDefinitions={shiftDefs as any}
          scheduleShifts={scheduleShifts as any}
        />
      </div>
    </div>
  )
}