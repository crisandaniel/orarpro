// src/app/api/schedules/[id]/generate-business/route.ts
// Generează orar business via CP-SAT Python (Railway).
// Pattern identic cu generate-school/route.ts.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { addDays, format, parseISO } from 'date-fns'
import { getHolidaysInRange } from '@/lib/holidays'

function buildWorkingDates(schedule: any, holidays: any[]): string[] {
  const dates: string[] = []
  const holidaySet = new Set(holidays.map((h: any) => h.date))
  let current = parseISO(schedule.start_date)
  const end   = parseISO(schedule.end_date)
  while (current <= end) {
    const dateStr = format(current, 'yyyy-MM-dd')
    const dow = current.getDay() === 0 ? 7 : current.getDay()
    if (
      schedule.working_days?.includes(dow) &&
      !(holidaySet.has(dateStr) && !schedule.include_holidays)
    ) dates.push(dateStr)
    current = addDays(current, 1)
  }
  return dates
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  const { hard_config, soft_rules } = await request.json()

  const { data: schedule } = await admin
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('organization_id', ctx.org.id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const { data: scheduleShifts } = await admin
    .from('schedule_shifts')
    .select('slots_per_day, shift_definition:shift_definitions(*)')
    .eq('schedule_id', scheduleId)

  if (!scheduleShifts?.length) {
    return NextResponse.json(
      { error: 'Nu există ture salvate. Salvează turele mai întâi.' },
      { status: 400 }
    )
  }

  const shiftDefs = scheduleShifts.map((ss: any) => ({
    ...ss.shift_definition,
    slots_per_day: ss.slots_per_day ?? 1,
  }))

  const { data: employees } = await admin
    .from('employees')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .eq('is_active', true)

  if (!employees?.length) {
    return NextResponse.json({ error: 'Nu există angajați activi.' }, { status: 400 })
  }

  const empIds = employees.map((e: any) => e.id)

  const [leavesRes, unavailRes] = await Promise.all([
    admin.from('employee_leaves')
      .select('employee_id, start_date, end_date')
      .in('employee_id', empIds)
      .gte('end_date', schedule.start_date)
      .lte('start_date', schedule.end_date),
    admin.from('employee_unavailability')
      .select('employee_id, day_of_week, specific_date')
      .in('employee_id', empIds),
  ])

  const effectiveHard = hard_config?.enforce_legal_limits
    ? { ...hard_config, max_consecutive_days: 6, min_rest_hours: 11, max_weekly_hours: 48 }
    : (hard_config ?? {})

  const holidays = await getHolidaysInRange(
    schedule.country_code, schedule.start_date, schedule.end_date
  )
  const workingDates = buildWorkingDates(schedule, holidays)

  const payload = {
    working_dates: workingDates,
    employees: employees.map((e: any) => ({
      id: e.id, name: e.name, experience_level: e.experience_level, color: e.color,
      unavailable_days: (unavailRes.data ?? [])
        .filter((u: any) => u.employee_id === e.id && u.day_of_week !== null)
        .map((u: any) => u.day_of_week),
      unavailable_dates: (unavailRes.data ?? [])
        .filter((u: any) => u.employee_id === e.id && u.specific_date !== null)
        .map((u: any) => u.specific_date),
    })),
    shift_definitions: shiftDefs.map((s: any) => ({
      id: s.id, name: s.name, shift_type: s.shift_type ?? 'custom',
      start_time: s.start_time, end_time: s.end_time,
      crosses_midnight: s.crosses_midnight ?? false,
      slots_per_day: s.slots_per_day,
    })),
    leaves: (leavesRes.data ?? []).map((l: any) => ({
      employee_id: l.employee_id, start_date: l.start_date, end_date: l.end_date,
    })),
    hard_config: effectiveHard,
    soft_rules: soft_rules ?? {},
    solver_time_limit_seconds: 50,
  }

  const solverUrl = process.env.SOLVER_URL
  if (!solverUrl) return NextResponse.json({ error: 'SOLVER_URL not configured' }, { status: 500 })

  try {
    await fetch(`${solverUrl}/health`, { signal: AbortSignal.timeout(10_000) })
  } catch { /* warm or timeout */ }

  let solverResult: any
  try {
    const res = await fetch(`${solverUrl}/solve/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65_000),
    })
    solverResult = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: solverResult.detail ?? 'Solver error', debug_log: solverResult.debug_log ?? [], violations: solverResult.violations ?? [] },
        { status: 500 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Solver timeout sau indisponibil' }, { status: 503 })
  }

  // Șterge asignările vechi non-manuale
  await admin.from('shift_assignments').delete()
    .eq('schedule_id', scheduleId)
    .eq('is_manual_override', false)

  const assignments = (solverResult.assignments ?? []).map((a: any) => ({
    schedule_id:         scheduleId,
    employee_id:         a.employee_id,
    shift_definition_id: a.shift_definition_id,
    date:                a.date,
    role_in_shift:       null,
    is_manual_override:  false,
    note:                null,
  }))

  if (assignments.length > 0) {
    const BATCH = 200
    for (let i = 0; i < assignments.length; i += BATCH) {
      const { error } = await admin.from('shift_assignments').insert(assignments.slice(i, i + BATCH))
      if (error) {
        return NextResponse.json(
          { error: 'Eroare la salvarea asignărilor', debug_log: solverResult.debug_log ?? [] },
          { status: 500 }
        )
      }
    }
  }

  await admin.from('schedules')
    .update({ status: 'generated', updated_at: new Date().toISOString() })
    .eq('id', scheduleId)

  // Fetch asignările cu joins pentru afișare imediată în BusinessSetupClient
  // (identic cu cum generate-school returnează date complete — fără fetch extra din client)
  const { data: assignmentsWithJoins } = await admin
    .from('shift_assignments')
    .select('*, employees(name,color), shift_definitions(name,color,start_time,end_time,shift_type)')
    .eq('schedule_id', scheduleId)

  const shiftDefsWithJoins = (scheduleShifts ?? []).map((ss: any) => ss.shift_definition).filter(Boolean)

  return NextResponse.json({
    ok:          true,
    stats:       solverResult.stats,
    violations:  solverResult.violations ?? [],
    debug_log:   solverResult.debug_log ?? [],
    assignments: assignmentsWithJoins ?? [],
    shiftDefs:   shiftDefsWithJoins,
  })
}