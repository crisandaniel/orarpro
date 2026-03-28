// POST /api/employees — creates employee, checks plan employee limit first.
// PATCH /api/employees — updates employee (name, color, level, active).
// Uses createAdminClient() to bypass RLS.
// Used by: EmployeeList component for add/edit/deactivate.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const org = ctx.org

  // Check employee limit
  const { count } = await admin
    .from('employees')
    .select('id', { count: 'exact' })
    .eq('organization_id', ctx.org.id)
    .eq('is_active', true)

  if (count !== null && count >= (org?.max_employees ?? 10)) {
    return NextResponse.json({ error: 'Employee limit reached. Please upgrade your plan.' }, { status: 403 })
  }

  const { data: employee, error } = await admin
    .from('employees')
    .insert({
      organization_id: ctx.org.id,
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

// POST /api/employees/leaves — add a leave
// DELETE /api/employees/leaves — remove a leave
// Separate from employee CRUD to keep route clean.
// Note: Next.js doesn't allow sub-routes here, so we check a 'action' param.

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leaveId } = await request.json()
  if (!leaveId) return NextResponse.json({ error: 'leaveId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the leave belongs to user's org
  const { data: leave } = await admin
    .from('employee_leaves')
    .select('employee_id, employees(organization_id)')
    .eq('id', leaveId)
    .single()

  const orgId = (leave as any)?.employees?.organization_id
  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await admin.from('employee_leaves').delete().eq('id', leaveId)
  return NextResponse.json({ success: true })
}