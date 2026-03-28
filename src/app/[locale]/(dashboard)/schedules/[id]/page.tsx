// Schedule view page — server component using DAL.
// Routes based on schedule type:
//   type='school' + draft/generating → redirect to school-setup
//   type='school' + generated/published → show timetable
//   type='shifts' → show shift schedule view

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
import { TimetableGrid } from '@/components/schedule/TimetableGrid'

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

  // ── School schedule routing ───────────────────────────────────────────────
  if (schedule.type === 'school') {
    const isDraft = schedule.status === 'draft' || schedule.status === 'generating'
    if (isDraft) {
      redirect(`/${locale}/schedules/${id}/school-setup`)
    }
    // Generated/published → show timetable
    return <SchoolScheduleView schedule={schedule} scheduleId={id} locale={locale} orgId={ctx.org.id} />
  }

  // ── Shifts schedule ───────────────────────────────────────────────────────
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

// ── School timetable view ─────────────────────────────────────────────────────

async function SchoolScheduleView({ schedule, scheduleId, locale, orgId }: {
  schedule: any; scheduleId: string; locale: string; orgId: string
}) {
  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  const [lessonsRes, teachersRes, subjectsRes, classesRes, roomsRes, configRes] = await Promise.all([
    admin.from('school_lessons')
      .select('*, school_teachers(name,color), school_subjects(name,short_name,color), school_classes(name), school_rooms(name)')
      .eq('schedule_id', scheduleId),
    admin.from('school_teachers').select('*').eq('organization_id', orgId),
    admin.from('school_subjects').select('*').eq('organization_id', orgId),
    admin.from('school_classes').select('*').eq('organization_id', orgId),
    admin.from('school_rooms').select('*').eq('organization_id', orgId),
    admin.from('school_configs').select('*').eq('schedule_id', scheduleId).single(),
  ])

  const lessons   = lessonsRes.data ?? []
  const teachers  = teachersRes.data ?? []
  const subjects  = subjectsRes.data ?? []
  const classes   = classesRes.data ?? []
  const rooms     = roomsRes.data ?? []
  const config    = configRes.data

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{schedule.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            {format(new Date(schedule.start_date), 'd MMM')} –{' '}
            {format(new Date(schedule.end_date), 'd MMM yyyy')}
            {' · '}{lessons.length} lecții generate
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href={`/${locale}/schedules/${scheduleId}/school-setup`}
            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', border: '0.5px solid #d1d5db', color: '#374151', background: '#fff', textDecoration: 'none' }}>
            ← Modifică asignările
          </Link>
          <ScheduleActions scheduleId={scheduleId} status={schedule.status} locale={locale} />
        </div>
      </div>

      {lessons.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', border: '0.5px solid #e5e7eb' }}>
          <p style={{ fontSize: '15px', color: '#374151', marginBottom: '8px' }}>Orarul nu a fost generat încă.</p>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>Configurează asignările și apasă "Generează orarul".</p>
          <Link href={`/${locale}/schedules/${scheduleId}/school-setup`}
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', background: '#2563eb', color: '#fff', textDecoration: 'none' }}>
            Mergi la configurare →
          </Link>
        </div>
      ) : (
        <TimetableGrid
          lessons={lessons as any}
          teachers={teachers as any}
          subjects={subjects as any}
          classes={classes as any}
          rooms={rooms as any}
          periodsPerDay={config?.periods_per_day ?? 7}
          periodDuration={config?.period_duration_min ?? 50}
          firstPeriodStart={config?.first_period_start ?? '08:00'}
          workingDays={schedule.working_days ?? [1,2,3,4,5]}
          scheduleId={scheduleId}
          locale={locale}
        />
      )}
    </div>
  )
}