// POST /api/schedules/[id]/constraints — adds a hard constraint to the schedule.
// DELETE /api/schedules/[id]/constraints — removes a constraint by ID.
// Uses createAdminClient() to bypass RLS.
// Used by: schedules/[id]/constraints/page.tsx (step 3 of wizard).

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
  const body = await request.json()
  const { type, employee_id, target_employee_id, shift_definition_id, value, note } = body

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: constraint, error } = await admin
    .from('constraints')
    .insert({
      schedule_id: scheduleId,
      type,
      employee_id: employee_id || null,
      target_employee_id: target_employee_id || null,
      shift_definition_id: shift_definition_id || null,
      value: value || null,
      note: note || null,
      is_active: true,
    })
    .select()
    .single()

  if (error || !constraint) {
    console.error('Constraint insert error:', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to add constraint' }, { status: 500 })
  }

  return NextResponse.json({ success: true, constraint })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { constraintId } = await request.json()

  const { error } = await admin
    .from('constraints')
    .delete()
    .eq('id', constraintId)
    .eq('schedule_id', scheduleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}