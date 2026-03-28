// Schedule view page — server component using DAL.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getScheduleWithData } from '@/lib/dal/schedules'
import { getEmployees } from '@/lib/dal/employees'
import { getHolidaysInRange } from '@/lib/holidays'
import { format } from 'date-fns'
import { ScheduleView } from '@/components/schedule/ScheduleView'
import { ScheduleActions } from '@/components/schedule/ScheduleActions'
import { AISuggestionsPanel } from '@/components/schedule/AISuggestionsPanel'
import { ConstraintsPanel } from '@/components/schedule/ConstraintsPanel'
import { EmployeeStats } from '@/components/schedule/EmployeeStats'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function ScheduleViewPage({ params }: Props) {
  const { id, locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const { schedule, assignments, shiftDefs, scheduleShifts, constraints } =
    await getScheduleWithData(id, ctx.org.id)

  if (!schedule) notFound()

  const [employees, holidays] = await Promise.all([
    getEmployees(ctx.org.id),
    getHolidaysInRange(schedule.country_code, schedule.start_date, schedule.end_date),
  ])

  const aiSuggestions = schedule.ai_suggestions as any[] | null

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 print-hide">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{schedule.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            {format(new Date(schedule.start_date), 'd MMM')} –{' '}
            {format(new Date(schedule.end_date), 'd MMM yyyy')}
            {' · '}{employees.length} {employees.length === 1 ? 'angajat' : 'angajați'}
          </p>
        </div>
        <ScheduleActions scheduleId={id} status={schedule.status} locale={locale} />
      </div>

      {/* Print title */}
      <div className="print-only" style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{schedule.name}</h1>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
          {format(new Date(schedule.start_date), 'd MMM yyyy')} –{' '}
          {format(new Date(schedule.end_date), 'd MMM yyyy')}
          {' · '}{employees.length} angajați
        </p>
      </div>

      {shiftDefs.length === 0 && (
        <div className="mb-4 p-4 rounded-xl text-sm print-hide flex items-center justify-between"
          style={{ background: '#fffbeb', border: '0.5px solid #fde68a', color: '#92400e' }}>
          <span>⚠️ Nicio tură definită pentru acest orar.</span>
          <Link href={`/${locale}/schedules/${id}/setup`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: '#d97706' }}>
            Configurează turele →
          </Link>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <ScheduleView
            schedule={schedule as any}
            initialAssignments={assignments}
            employees={employees as any}
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

      <div className="print-hide">
        <ConstraintsPanel
          scheduleId={id}
          schedule={schedule as any}
          initialConstraints={constraints as any}
          employees={employees as any}
          shiftDefinitions={shiftDefs as any}
          scheduleShifts={scheduleShifts as any}
        />
      </div>
    </div>
  )
}
