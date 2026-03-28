// DELETE /api/schedules/[id]/delete — permanently deletes a schedule and all its data.
// Verifies the schedule belongs to the user's organization before deleting.
// Used by: ScheduleActions component delete button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  // Delete child records first to avoid FK violations
  await admin.from('shift_assignments').delete().eq('schedule_id', id)
  await admin.from('schedule_shifts').delete().eq('schedule_id', id)
  await admin.from('constraints').delete().eq('schedule_id', id)

  const { error } = await admin.from('schedules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
