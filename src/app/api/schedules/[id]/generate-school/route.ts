// POST /api/schedules/[id]/generate-school
// Builds solver payload from curriculum_items + schedule_config,
// calls CP-SAT solver, saves lessons to DB.
// No greedy fallback — if CP-SAT fails, returns clear error.

export const maxDuration = 300  // Vercel Pro: allow up to 5min

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getCurriculumItems, getScheduleConfig } from '@/lib/dal/school'

const SOLVER_URL = process.env.SOLVER_URL

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No org' }, { status: 401 })

  const { id: scheduleId } = await params
  const admin = createAdminClient()

  // Verify ownership
  const { data: schedule } = await admin
    .from('schedules').select('id').eq('id', scheduleId)
    .eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Load config + curriculum
  const [config, curriculum] = await Promise.all([
    getScheduleConfig(scheduleId),
    getCurriculumItems(scheduleId),
  ])

  if (!config)               return NextResponse.json({ error: 'Config not found. Save setup first.' }, { status: 400 })
  if (!curriculum.length)    return NextResponse.json({ error: 'No curriculum items defined.' }, { status: 400 })

  // Load teacher resources for unavailable/preferred slots
  const teacherIds = [...new Set(curriculum.map((c: any) => c.teacher_id))]
  const { data: teachers } = await admin
    .from('school_teachers')
    .select('id, name, unavailable_slots, preferred_slots, max_lessons_per_day, max_lessons_per_week, min_lessons_per_week')
    .in('id', teacherIds)

  // Load rooms for subject type matching
  const { data: rooms } = await admin
    .from('school_rooms').select('id, name, type, capacity')
    .eq('organization_id', ctx.org.id)

  const D = config.days_per_week
  const P = config.slots_per_day
  const softRules = config.soft_rules ?? {}

  // ── Build solver payload ──────────────────────────────────────────────────
  // Convert curriculum items to Lesson objects with allowedSlots calculated
  const allSlots = Array.from({ length: D }, (_, d) =>
    Array.from({ length: P }, (_, p) => `${d}-${p}`)
  ).flat()

  const lessons = curriculum.flatMap((item: any) => {
    const teacher = teachers?.find(t => t.id === item.teacher_id)
    const unavailable = new Set(teacher?.unavailable_slots ?? [])

    // Calculate allowedSlots: all slots minus teacher's unavailable
    const allowedSlots = allSlots.filter(slot => !unavailable.has(slot))

    // Expand lesson_pattern into individual lessons
    const pattern = item.lesson_pattern ?? Array(item.weekly_hours).fill(1)
    return pattern.map((duration: number, idx: number) => ({
      id:           `${item.id}-${idx}`,
      class_id:     item.class_id,
      subject_id:   item.subject_id,
      teacher_id:   item.teacher_id,
      duration,
      allowed_slots: allowedSlots,
      preferred_room_id: item.preferred_room_id ?? null,
    }))
  })

  const solverPayload = {
    schedule_id:  scheduleId,
    lessons,
    teachers: (teachers ?? []).map(t => ({
      id:                   t.id,
      name:                 t.name,
      max_lessons_per_day:  t.max_lessons_per_day,
      max_lessons_per_week: t.max_lessons_per_week,
      min_lessons_per_week: t.min_lessons_per_week,
      preferred_slots:      t.preferred_slots ?? [],
    })),
    classes: [...new Set(curriculum.map((c: any) => c.class_id))].map(classId => {
      const classItems = curriculum.filter((c: any) => c.class_id === classId)
      const classInfo  = classItems[0]?.school_classes
      return {
        id:                  classId,
        name:                classInfo?.name ?? classId,
        stage:               classInfo?.stage ?? 'high',
        max_lessons_per_day: 6,  // placeholder — overwritten below by classData
      }
    }),
    rooms: (rooms ?? []).map(r => ({ id: r.id, name: r.name, type: r.type })),
    days_per_week:  D,
    slots_per_day:  P,
    soft_rules:     softRules,
    solver_time_limit_seconds: 50,
  }

  // Fix: load class max_lessons_per_day properly
  const classIds = [...new Set(curriculum.map((c: any) => c.class_id))]
  const { data: classData } = await admin
    .from('school_classes').select('id, name, stage, max_lessons_per_day').in('id', classIds)

  solverPayload.classes = (classData ?? []).map(c => ({
    id:                  c.id,
    name:                c.name,
    stage:               c.stage,
    max_lessons_per_day: c.max_lessons_per_day,
  }))

  console.log(`[generate-school] Payload: ${lessons.length} lessons, ${D}d×${P}p, ${curriculum.length} items`)
  console.log('[generate-school] Sample class:', JSON.stringify(solverPayload.classes[0]))
  console.log('[generate-school] Sample teacher:', JSON.stringify(solverPayload.teachers[0]))
  console.log('[generate-school] Soft rules:', JSON.stringify(solverPayload.soft_rules))
  console.log('[generate-school] Sample lesson:', JSON.stringify(solverPayload.lessons[0]))

  if (!SOLVER_URL) {
    return NextResponse.json({ error: 'Solver URL not configured (SOLVER_URL env var missing).' }, { status: 503 })
  }

  // ── Wake up solver (Railway cold start) ─────────────────────────────────
  try {
    await fetch(`${SOLVER_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(10_000) })
  } catch {
    // Ignore — solver might still be starting, /solve will handle timeout
  }

  // ── Call CP-SAT solver ────────────────────────────────────────────────────
  let result: any
  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(`${SOLVER_URL}/solve/school`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(solverPayload),
      signal:  controller.signal,
    })
    clearTimeout(timeout)
    result = await res.json()
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Solver timeout (>55s)' : `Solver error: ${err.message}`
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  // If no feasible solution
  if (!result.timetable?.length) {
    await admin.from('schedules').update({ status: 'draft' }).eq('id', scheduleId)
    return NextResponse.json({
      error:      'Nu s-a găsit o soluție fezabilă.',
      violations: result.violations ?? [],
      debug_log:  result.debug_log  ?? [],
    }, { status: 422 })
  }

  // ── Save lessons to DB ────────────────────────────────────────────────────
  await admin.from('school_lessons').delete().eq('schedule_id', scheduleId)

  const rows = result.timetable.map((l: any) => ({
    schedule_id: scheduleId,
    class_id:    l.class_id,
    subject_id:  l.subject_id,
    teacher_id:  l.teacher_id,
    room_id:     l.room_id ?? null,
    day:         l.day,
    period:      l.period,
    duration:    l.duration ?? 1,
    is_manual:   false,
  }))

  const { error: insertErr } = await admin.from('school_lessons').insert(rows)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  await admin.from('schedules').update({ status: 'generated' }).eq('id', scheduleId)
  await admin.from('schedule_configs').update({
    solver_used:  `cp-sat (${result.stats?.solver_status ?? 'FEASIBLE'})`,
    generated_at: new Date().toISOString(),
  }).eq('schedule_id', scheduleId)

  console.log(`[generate-school] Done: ${rows.length} lessons saved`)

  return NextResponse.json({
    success:    true,
    solver:     `cp-sat (${result.stats?.solver_status ?? 'FEASIBLE'})`,
    debug_log:  result.debug_log ?? [],
    violations: result.violations ?? [],
    stats:      { ...result.stats, scheduled_lessons: rows.length },
  })
}