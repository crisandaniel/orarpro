// PUT /api/resources/time-config
// Saves days_per_week and slots_per_day to the organization record.
// Used by: ResourcesClient time tab.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No org' }, { status: 401 })

  const { days_per_week, slots_per_day } = await request.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('organizations')
    .update({ days_per_week, slots_per_day })
    .eq('id', ctx.org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
