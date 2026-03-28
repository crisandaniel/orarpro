// PATCH /api/organizations/[id] — updates organization name and org_type.
// Used by: Settings page org edit form.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { name, org_type } = await request.json()

  // Verify user is owner/admin of this org
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Check for duplicate name (among this user's other orgs)
  if (name) {
    const { data: memberships } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)

    const otherOrgIds = (memberships ?? [])
      .map(m => m.organization_id)
      .filter(oid => oid !== id)

    if (otherOrgIds.length > 0) {
      const { data: dup } = await admin
        .from('organizations')
        .select('id')
        .in('id', otherOrgIds)
        .ilike('name', name.trim())
        .limit(1)
      if (dup && dup.length > 0) {
        return NextResponse.json({ error: 'Ai deja o organizație cu acest nume.' }, { status: 400 })
      }
    }
  }

  const updates: any = {}
  if (name) updates.name = name.trim()
  if (org_type) updates.org_type = org_type

  const { error } = await admin.from('organizations').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Only owner can delete
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', id)
    .single()

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Doar proprietarul poate șterge organizația.' }, { status: 403 })
  }

  // Load all schedule IDs for this org
  const { data: schedules } = await admin
    .from('schedules').select('id').eq('organization_id', id)
  const scheduleIds = (schedules ?? []).map(s => s.id)

  if (scheduleIds.length > 0) {
    await admin.from('shift_assignments').delete().in('schedule_id', scheduleIds)
    await admin.from('school_lessons').delete().in('schedule_id', scheduleIds)
    await admin.from('school_assignments').delete().in('schedule_id', scheduleIds)
    await admin.from('school_configs').delete().in('schedule_id', scheduleIds)
    await admin.from('constraints').delete().in('schedule_id', scheduleIds)
    await admin.from('schedule_shifts').delete().in('schedule_id', scheduleIds)
    await admin.from('schedules').delete().in('id', scheduleIds)
  }

  // Delete school resources
  const { data: classes } = await admin
    .from('school_classes').select('id').eq('organization_id', id)
  if (classes && classes.length > 0) {
    await admin.from('school_groups').delete().in('class_id', classes.map((c: any) => c.id))
  }
  await admin.from('school_classes').delete().eq('organization_id', id)
  await admin.from('school_teachers').delete().eq('organization_id', id)
  await admin.from('school_subjects').delete().eq('organization_id', id)
  await admin.from('school_rooms').delete().eq('organization_id', id)

  // Delete employees and shift definitions
  await admin.from('employees').delete().eq('organization_id', id)
  await admin.from('shift_definitions').delete().eq('organization_id', id)

  // Clear active_organization_id for members pointing to this org
  await admin.from('profiles')
    .update({ active_organization_id: null })
    .eq('active_organization_id', id)

  // Delete memberships then org
  await admin.from('organization_members').delete().eq('organization_id', id)

  const { error } = await admin.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
