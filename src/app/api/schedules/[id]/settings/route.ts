// PATCH /api/schedules/[id]/settings — updates basic schedule settings.
// Fields: start_date, end_date, working_days, include_holidays, country_code.
// Used by: ConstraintsPanel "Salvează și regenerează" button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()

  // Verify ownership
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules').select('id')
    .eq('id', id).eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin
    .from('schedules')
    .update({
      start_date:       body.start_date,
      end_date:         body.end_date,
      working_days:     body.working_days,
      include_holidays: body.include_holidays,
      country_code:     body.country_code,
      // Reset status to draft so it can be regenerated
      status: 'draft',
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}