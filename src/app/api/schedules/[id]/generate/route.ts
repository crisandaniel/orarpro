import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { generateSchedule } from '@/lib/algorithms/generate'
import { analyzeScheduleWithAI } from '@/lib/ai/analyze'
import { getHolidaysInRange } from '@/lib/holidays'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const admin = createAdminClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load all data needed for generation
  const [scheduleRes, employeesRes, shiftDefsRes, scheduleShiftsRes, constraintsRes, leavesRes, unavailRes] = await Promise.all([
    supabase.from('schedules').select('*').eq('id', id).single(),
    supabase.from('employees').select('*').eq('is_active', true),
    supabase.from('shift_definitions').select('*'),
    supabase.from('schedule_shifts').select('*').eq('schedule_id', id),
    supabase.from('constraints').select('*').eq('schedule_id', id).eq('is_active', true),
    supabase.from('employee_leaves').select('*'),
    supabase.from('employee_unavailability').select('*'),
  ])

  const schedule = scheduleRes.data
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  // Mark as generating
  await admin.from('schedules').update({ status: 'generating' }).eq('id', id)

  // Fetch holidays
  const holidays = schedule.include_holidays
    ? await getHolidaysInRange(schedule.country_code, schedule.start_date, schedule.end_date)
    : []

  // Build slots per shift map
  const slotsPerShift: Record<string, number> = {}
  for (const ss of scheduleShiftsRes.data ?? []) {
    slotsPerShift[ss.shift_definition_id] = ss.slots_per_day
  }

  // Only include shift defs linked to this schedule
  const linkedShiftIds = new Set((scheduleShiftsRes.data ?? []).map((ss) => ss.shift_definition_id))
  const shiftDefs = (shiftDefsRes.data ?? []).filter((s) => linkedShiftIds.has(s.id))

  // Run generation algorithm
  const result = generateSchedule({
    schedule: schedule as any,
    employees: employeesRes.data ?? [],
    shiftDefinitions: shiftDefs as any,
    constraints: constraintsRes.data as any ?? [],
    leaves: leavesRes.data ?? [],
    unavailability: unavailRes.data ?? [],
    holidays,
    slotsPerShift,
  })

  // Delete existing assignments for this schedule
  await admin.from('shift_assignments').delete().eq('schedule_id', id)

  // Insert new assignments in batches
  const BATCH_SIZE = 100
  for (let i = 0; i < result.assignments.length; i += BATCH_SIZE) {
    const batch = result.assignments.slice(i, i + BATCH_SIZE)
    await admin.from('shift_assignments').insert(batch)
  }

  // Run AI analysis
  const locale = request.headers.get('accept-language')?.startsWith('ro') ? 'ro' : 'en'
  const aiSuggestions = await analyzeScheduleWithAI({
    schedule: schedule as any,
    assignments: result.assignments as any,
    employees: employeesRes.data ?? [],
    shiftDefinitions: shiftDefs as any,
    constraints: constraintsRes.data as any ?? [],
    violations: result.violations,
    locale,
  })

  // Update schedule status and AI suggestions
  await admin.from('schedules').update({
    status: 'generated',
    ai_suggestions: aiSuggestions,
    ai_analyzed_at: new Date().toISOString(),
  }).eq('id', id)

  // Log audit event
  await admin.from('audit_log').insert({
    user_id: user.id,
    action: 'schedule_generate',
    resource: 'schedule',
    resource_id: id,
    metadata: {
      filled_slots: result.stats.filledSlots,
      total_slots: result.stats.totalSlots,
      violations: result.violations.length,
    },
  })

  return NextResponse.json({
    success: true,
    stats: result.stats,
    violations: result.violations,
    aiSuggestions,
  })
}
