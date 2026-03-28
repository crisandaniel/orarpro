// POST /api/employees/leaves — add a leave for an employee
// DELETE /api/employees/leaves — remove a leave
// Uses createAdminClient() — no 401 issues from browser client.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { employee_id, start_date, end_date, reason } = await request.json()

  const admin = createAdminClient()

  // Verify employee belongs to this org
  const { data: emp } = await admin
    .from('employees')
    .select('id')
    .eq('id', employee_id)
    .eq('organization_id', ctx.org.id)
    .single()

  if (!emp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('employee_leaves')
    .insert({ employee_id, start_date, end_date, reason: reason || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { leaveId } = await request.json()
  const admin = createAdminClient()

  // Verify ownership
  const { data: leave } = await admin
    .from('employee_leaves')
    .select('employee_id, employees(organization_id)')
    .eq('id', leaveId)
    .single()

  if ((leave as any)?.employees?.organization_id !== ctx.org.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('employee_leaves').delete().eq('id', leaveId)
  return NextResponse.json({ success: true })
}