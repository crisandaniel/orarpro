// POST /api/schedules/[id]/publish — changes schedule status from 'generated' to 'published'.
// Only schedules with status 'generated' can be published.
// Uses createAdminClient() to bypass RLS.
// Used by: schedules/[id]/page.tsx Publish button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify schedule exists and belongs to user's org
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  if (schedule.status !== 'generated') {
    return NextResponse.json(
      { error: 'Only generated schedules can be published' },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from('schedules')
    .update({ status: 'published' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}