// GET /api/schedules/[id]/lessons
// Returns generated school lessons with joins for TimetableGrid.
// v4: uses new school_lessons schema (no school_groups, no assignment_id).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const admin = createAdminClient()

  const { data: schedule } = await admin
    .from('schedules').select('id, organization_id')
    .eq('id', scheduleId).eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lessons, error } = await admin
    .from('school_lessons')
    .select(`
      *,
      school_classes  ( name ),
      school_subjects ( name, short_name, color ),
      school_teachers ( name, color ),
      school_rooms    ( name )
    `)
    .eq('schedule_id', scheduleId)
    .order('day').order('period')

  if (error) {
    console.error('[lessons GET] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lessons: lessons ?? [] })
}
