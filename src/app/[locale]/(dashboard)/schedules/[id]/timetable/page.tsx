// School timetable view page.
// Shows generated timetable as a grid: periods (rows) × days (cols).
// Can filter by: class, teacher, room.
// Route: /[locale]/schedules/[id]/timetable

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TimetableGrid } from '@/components/schedule/TimetableGrid'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

export default async function TimetablePage({ params }: Props) {
  const { id, locale } = await params
  const supabase = await createServerSupabaseClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: membership } = await supabase
    .from('organization_members').select('organization_id').eq('user_id', user.id).single()

  const { data: schedule } = await admin
    .from('schedules').select('*').eq('id', id).single()
  if (!schedule) notFound()

  const [configRes, teachersRes, subjectsRes, classesRes, roomsRes, lessonsRes] =
    await Promise.all([
      admin.from('school_configs').select('*').eq('schedule_id', id).single(),
      admin.from('school_teachers').select('*').eq('organization_id', membership?.organization_id ?? ''),
      admin.from('school_subjects').select('*').eq('organization_id', membership?.organization_id ?? ''),
      admin.from('school_classes').select('*').eq('organization_id', membership?.organization_id ?? ''),
      admin.from('school_rooms').select('*').eq('organization_id', membership?.organization_id ?? ''),
      admin.from('school_lessons').select(`
        *,
        school_teachers(name, color),
        school_subjects(name, short_name, color),
        school_classes(name),
        school_groups(name),
        school_rooms(name)
      `).eq('schedule_id', id),
    ])

  const config   = configRes.data
  const teachers = teachersRes.data ?? []
  const subjects = subjectsRes.data ?? []
  const classes  = classesRes.data ?? []
  const rooms    = roomsRes.data ?? []
  const lessons  = lessonsRes.data ?? []

  const workingDays = schedule.working_days ?? [1,2,3,4,5]
  const DAY_NAMES = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum']

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 print-hide">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{schedule.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            Orar {config?.institution_type ?? 'școlar'} ·{' '}
            {lessons.length} ore plasate ·{' '}
            {classes.length} clase · {teachers.length} profesori
          </p>
        </div>
        <div className="flex gap-2 print-hide">
          <a href={`/${locale}/schedules/${id}/school-setup`}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '0.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
            Editează configurare
          </a>
        </div>
      </div>

      <TimetableGrid
        lessons={lessons as any}
        teachers={teachers as any}
        subjects={subjects as any}
        classes={classes as any}
        rooms={rooms as any}
        periodsPerDay={config?.periods_per_day ?? 7}
        periodDuration={config?.period_duration_min ?? 50}
        firstPeriodStart={config?.first_period_start ?? '08:00'}
        workingDays={workingDays}
        scheduleId={id}
        locale={locale}
      />
    </div>
  )
}
