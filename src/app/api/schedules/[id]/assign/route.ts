// POST /api/schedules/[id]/assign — manually assign an employee to a shift on a date.
// DELETE /api/schedules/[id]/assign — remove an assignment.
// Sets is_manual_override = true so the algorithm doesn't overwrite it.
// Used by: ScheduleGrid cell editor.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { employeeId, shiftDefinitionId, date } = await request.json()
  const admin = createAdminClient()

  // Check if assignment already exists
  const { data: existing } = await admin
    .from('shift_assignments')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('employee_id', employeeId)
    .eq('shift_definition_id', shiftDefinitionId)
    .eq('date', date)
    .single()

  if (existing) return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 })

  const { data, error } = await admin
    .from('shift_assignments')
    .insert({
      schedule_id: scheduleId,
      employee_id: employeeId,
      shift_definition_id: shiftDefinitionId,
      date,
      is_manual_override: true,
    })
    .select('*, employees(name, color), shift_definitions(name, color, start_time, end_time, shift_type)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, assignment: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { employeeId, shiftDefinitionId, date } = await request.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('shift_assignments')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('employee_id', employeeId)
    .eq('shift_definition_id', shiftDefinitionId)
    .eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}