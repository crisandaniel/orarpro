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

  const { name, country_code, org_type } = await request.json()
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
  }

  // Use admin client to bypass RLS for inserts
  const admin = createAdminClient()

  // Check for duplicate name for this user's orgs
  const { data: userMemberships } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)

  if (userMemberships && userMemberships.length > 0) {
    const orgIds = userMemberships.map(m => m.organization_id)
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .in('id', orgIds)
      .ilike('name', name.trim())
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Ai deja o organizație cu acest nume.' }, { status: 400 })
    }
  }

  // Ensure profile exists — Google OAuth may not trigger handle_new_user() reliably
  await admin.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  }, { onConflict: 'id', ignoreDuplicates: true })

  // Create organization (admin bypasses RLS)
  // Multiple orgs per user are allowed — active org is tracked in profiles
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, country_code: country_code || 'RO', org_type: org_type || 'business' })
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

  // Set as active organization for this user
  await admin.from('profiles')
    .update({ active_organization_id: org.id })
    .eq('id', user.id)

  return NextResponse.json({ success: true, organizationId: org.id })
}