// POST /api/employees — creates employee, checks plan employee limit first.
// PATCH /api/employees — updates employee (name, color, level, active).
// Uses createAdminClient() to bypass RLS.
// Used by: EmployeeList component for add/edit/deactivate.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id, organizations(max_employees)')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const org = membership.organizations as any

  // Check employee limit
  const { count } = await admin
    .from('employees')
    .select('id', { count: 'exact' })
    .eq('organization_id', membership.organization_id)
    .eq('is_active', true)

  if (count !== null && count >= (org?.max_employees ?? 10)) {
    return NextResponse.json({ error: 'Employee limit reached. Please upgrade your plan.' }, { status: 403 })
  }

  const { data: employee, error } = await admin
    .from('employees')
    .insert({
      organization_id: membership.organization_id,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      experience_level: body.experience_level || 'mid',
      color: body.color || '#6366f1',
    })
    .select()
    .single()

  if (error || !employee) {
    return NextResponse.json({ error: error?.message ?? 'Failed to add employee' }, { status: 500 })
  }

  return NextResponse.json({ success: true, employee })
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { id, ...updates } = body

  const { data: employee, error } = await admin
    .from('employees')
    .update({
      name: updates.name,
      email: updates.email || null,
      phone: updates.phone || null,
      experience_level: updates.experience_level,
      color: updates.color,
      is_active: updates.is_active,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !employee) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update employee' }, { status: 500 })
  }

  return NextResponse.json({ success: true, employee })
}
