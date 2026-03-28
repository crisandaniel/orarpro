// POST /api/schedules/[id]/generate-school
// Loads school config from DB, calls Python CP-SAT solver /solve/school,
// saves resulting lessons to school_lessons table.
// Falls back to a simple greedy if solver is unavailable.
// Used by: school-setup page "Generează orarul" button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

const SOLVER_URL = process.env.SOLVER_URL

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const orgId = ctx.org.id

  const { data: schedule } = await admin
    .from('schedules').select('*')
    .eq('id', scheduleId).eq('organization_id', orgId).single()
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  await admin.from('schedules').update({ status: 'generating' }).eq('id', scheduleId)

  // ── Load all school data ──────────────────────────────────────────────────
  const [configRes, teachersRes, subjectsRes, classesRes, groupsRes, roomsRes, assignmentsRes] =
    await Promise.all([
      admin.from('school_configs').select('*').eq('schedule_id', scheduleId).single(),
      admin.from('school_teachers').select('*').eq('organization_id', orgId),
      admin.from('school_subjects').select('*').eq('organization_id', orgId),
      admin.from('school_classes').select('*').eq('organization_id', orgId),
      admin.from('school_groups').select('*, school_classes(organization_id)').filter('school_classes.organization_id', 'eq', orgId),
      admin.from('school_rooms').select('*').eq('organization_id', orgId),
      admin.from('school_assignments').select('*').eq('schedule_id', scheduleId),
    ])

  const config    = configRes.data
  const teachers  = teachersRes.data ?? []
  const subjects  = subjectsRes.data ?? []
  const classes   = classesRes.data ?? []
  const groups    = groupsRes.data ?? []
  const rooms     = roomsRes.data ?? []
  const assignments = assignmentsRes.data ?? []

  if (!config) return NextResponse.json({ error: 'School config not found. Please save setup first.' }, { status: 400 })
  if (assignments.length === 0) return NextResponse.json({ error: 'No assignments defined.' }, { status: 400 })

  // ── Build solver payload ──────────────────────────────────────────────────
  const solverPayload = {
    schedule_id: scheduleId,
    teachers: teachers.map(t => ({
      id: t.id,
      name: t.name,
      subject_ids: assignments.filter(a => a.teacher_id === t.id).map(a => a.subject_id),
      max_periods_per_day: t.max_periods_per_day,
      max_periods_per_week: t.max_periods_per_week,
      unavailable_periods: [], // TODO: load from school_teacher_unavailability
    })),
    subjects: subjects.map(s => ({
      id: s.id,
      name: s.name,
      periods_per_week: 0, // computed per assignment
      requires_consecutive: false,
      room_type: s.required_room_type,
      preferred_morning: s.difficulty === 'hard',
    })),
    classes: classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      subject_ids: assignments
        .filter(a => a.class_id === cls.id && !a.group_id)
        .map(a => a.subject_id),
    })),
    rooms: rooms.map(r => ({
      id: r.id,
      name: r.name,
      room_type: r.room_type,
      capacity: r.capacity,
    })),
    days_per_week: (schedule.working_days ?? [1,2,3,4,5]).length,
    periods_per_day: config.periods_per_day,
    // Pass full assignments so solver can handle groups
    assignments: assignments.map(a => ({
      id: a.id,
      teacher_id: a.teacher_id,
      subject_id: a.subject_id,
      class_id: a.class_id,
      group_id: a.group_id,
      periods_per_week: a.periods_per_week,
      requires_consecutive: a.requires_consecutive,
    })),
    config: {
      avoid_teacher_windows: config.avoid_teacher_windows,
      hard_subjects_morning: config.hard_subjects_morning,
      max_periods_per_day: config.max_periods_per_day,
      min_periods_per_day: config.min_periods_per_day,
    },
    solver_time_limit_seconds: Math.min(
      60,
      Math.max(15, Math.ceil(teachers.length * classes.length * assignments.length / 10))
    ),
  }

  // ── Call CP-SAT solver ────────────────────────────────────────────────────
  let lessons: any[] = []
  let stats: any = {}
  let usedSolver = 'unavailable'

  if (SOLVER_URL) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 65_000)
      console.log('[generate-school] Sending to solver:', JSON.stringify({
        teachers: solverPayload.teachers.length,
        subjects: solverPayload.subjects.length,
        classes: solverPayload.classes.length,
        assignments: solverPayload.assignments.length,
        days_per_week: solverPayload.days_per_week,
        periods_per_day: solverPayload.periods_per_day,
      }))
      const res = await fetch(`${SOLVER_URL}/solve/school`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solverPayload),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) {
        const result = await res.json()
        console.log('[generate-school] Solver raw response keys:', Object.keys(result))
        console.log('[generate-school] Solver response:', JSON.stringify(result).substring(0, 500))

        // Try multiple possible response formats
        const timetable = result.timetable ?? result.lessons ?? result.schedule ?? result.data ?? []
        if (timetable.length > 0) {
          usedSolver = `cp-sat (${result.stats?.solver_status ?? result.status ?? 'FEASIBLE'})`
          lessons = timetable
          stats = result.stats ?? {}
          console.log(`[generate-school] CP-SAT: ${lessons.length} lessons`)
        } else {
          console.warn('[generate-school] CP-SAT returned empty timetable. Full response:', JSON.stringify(result).substring(0, 1000))
          if (result.violations?.length > 0) {
            console.warn('[generate-school] Violations:', result.violations[0]?.message)
          }
        }
      } else {
        const err = await res.text().catch(() => '')
        console.error(`[generate-school] Solver returned ${res.status}:`, err)
      }
    } catch (err: any) {
      console.warn('[generate-school] Solver unavailable:', err.message)
    }
  }

  if (lessons.length === 0) {
    await admin.from('schedules').update({ status: 'draft' }).eq('id', scheduleId)
    return NextResponse.json({
      error: usedSolver === 'unavailable'
        ? 'Solver-ul nu este disponibil. Verifică că Railway e pornit.'
        : 'Nu s-a putut găsi un orar fezabil. Relaxează constrângerile (mai puține ore/săpt, mai multe săli).',
      solver: usedSolver,
    }, { status: 422 })
  }

  // ── Save lessons to DB ────────────────────────────────────────────────────
  await admin.from('school_lessons').delete().eq('schedule_id', scheduleId)

  // Map solver output back to DB records
  // Solver returns day/period indices + teacher/subject/class/room IDs
  const lessonRows = lessons.map((l: any) => {
    const assignment = assignments.find(a =>
      a.teacher_id === l.teacher_id &&
      a.subject_id === l.subject_id &&
      a.class_id   === l.class_id
    )
    return {
      schedule_id:  scheduleId,
      assignment_id: assignment?.id ?? assignments[0]?.id,
      teacher_id:   l.teacher_id,
      subject_id:   l.subject_id,
      class_id:     l.class_id,
      group_id:     l.group_id ?? null,
      room_id:      l.room_id ?? null,
      day:          l.day,
      period:       l.period,
      is_manual_override: false,
    }
  })

  const BATCH = 100
  for (let i = 0; i < lessonRows.length; i += BATCH) {
    await admin.from('school_lessons').insert(lessonRows.slice(i, i + BATCH))
  }

  await admin.from('schedules').update({ status: 'generated' }).eq('id', scheduleId)

  return NextResponse.json({
    success: true,
    solver: usedSolver,
    stats: {
      ...stats,
      scheduled_lessons: lessons.length,
      total_assignments: assignments.length,
    },
  })
}