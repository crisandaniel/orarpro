// POST /api/schedules/[id]/school-setup
// Saves school config + assignments.
// Resources (teachers/subjects/classes/rooms) are pre-defined in /resources.
// Assignments use real UUIDs from DB (not array indices).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify ownership
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules').select('id').eq('id', scheduleId)
    .eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const body = await request.json()
  const { config, assignments } = body

  try {
    // ── School config (upsert) ──────────────────────────────────────────
    await admin.from('school_configs').delete().eq('schedule_id', scheduleId)
    await admin.from('school_configs').insert({
      schedule_id:           scheduleId,
      institution_type:      config.institutionType ?? 'highschool',
      periods_per_day:       config.periodsPerDay,
      period_duration_min:   config.periodDuration,
      first_period_start:    config.firstPeriod,
      max_periods_per_day:   config.maxPerDay,
      min_periods_per_day:   config.minPerDay,
      avoid_teacher_windows: config.avoidWindows,
      hard_subjects_morning: config.hardMorning,
    })

    // Update schedule working_days
    if (config.workingDays?.length > 0) {
      await admin.from('schedules')
        .update({ working_days: config.workingDays.map((d: number) => d + 1) })
        .eq('id', scheduleId)
    }

    // ── Assignments (replace all) ───────────────────────────────────────
    await admin.from('school_assignments').delete().eq('schedule_id', scheduleId)

    const validAssignments = (assignments ?? []).filter(
      (a: any) => a.teacher_id && a.subject_id && a.class_id
    )

    if (validAssignments.length > 0) {
      await admin.from('school_assignments').insert(
        validAssignments.map((a: any) => ({
          schedule_id:          scheduleId,
          teacher_id:           a.teacher_id,
          subject_id:           a.subject_id,
          class_id:             a.class_id,
          group_id:             a.group_id ?? null,
          lesson_type:          a.lesson_type ?? 'regular',
          periods_per_week:     a.periods_per_week ?? 2,
          requires_consecutive: a.requires_consecutive ?? false,
        }))
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[school-setup]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}