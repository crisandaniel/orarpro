// POST /api/organizations/switch — switches the active organization.
// Uses DAL for consistent query logic.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { switchActiveOrg } from '@/lib/dal/org'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { organizationId } = await request.json()
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const ok = await switchActiveOrg(user.id, organizationId)
  if (!ok) return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })

  return NextResponse.json({ success: true })
}
