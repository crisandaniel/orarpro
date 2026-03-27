// POST /api/organizations — creates a new organization + owner membership.
// Uses createAdminClient() to bypass RLS (INSERT on organizations requires it).
// Pattern: verify auth with regular client, write with admin client.
// Used by: setup/page.tsx after user fills org name + country.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

// Health check endpoint — useful for verifying the route is reachable
// before debugging more complex issues.
  export async function GET() {
  return NextResponse.json({ ok: true, message: 'Organizations API is running' })
}

export async function POST(request: Request) {
  // Pattern: verify identity with regular client (respects RLS),
  // then perform the write with admin client (bypasses RLS).
  // This is necessary because Supabase RLS blocks INSERT on 'organizations'
  // from the browser client even when the user is authenticated.
  // Use regular client to verify the user session
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, country_code } = await request.json()
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
  }

  // Use admin client to bypass RLS for inserts
  const admin = createAdminClient()

  // Check if user already has an organization
  const { data: existing } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'User already has an organization' }, { status: 400 })
  }

  // Create organization (admin bypasses RLS)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, country_code: country_code || 'RO' })
    .select()
    .single()

  if (orgError || !org) {
    console.error('Org creation error:', orgError)
    return NextResponse.json({ error: orgError?.message ?? 'Failed to create organization' }, { status: 500 })
  }

  // Add user as owner
  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
      accepted_at: new Date().toISOString(),
    })

  if (memberError) {
    console.error('Member creation error:', memberError)
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, organizationId: org.id })
}
