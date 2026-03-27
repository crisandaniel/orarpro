// GET /api/schedules/[id]/type — returns just the 'type' field ('shifts' or 'school').
// Lightweight endpoint so the setup page can show the correct UI variant.
// Used by: schedules/[id]/setup/page.tsx on mount.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('schedules')
    .select('type')
    .eq('id', id)
    .single()

  return NextResponse.json({ type: data?.type ?? 'shifts' })
}
