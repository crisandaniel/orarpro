// POST /api/resources — insert a school resource (teacher/subject/room/class)
// DELETE /api/resources — delete a school resource
// PUT /api/resources — update a school resource
// Uses createAdminClient() — bypasses RLS, verifies auth server-side.
// Used by: ResourcesClient.tsx

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

const ALLOWED_TABLES = [
  'school_teachers',
  'school_subjects',
  'school_classes',
  'school_rooms',
  'school_groups',
] as const

type AllowedTable = typeof ALLOWED_TABLES[number]

async function getAuth() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const ctx = await getOrgContext(user.id)
  if (!ctx) return null
  return { user, ctx }
}

export async function POST(request: Request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { table, data } = await request.json()
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from(table)
    .insert({ ...data, organization_id: auth.ctx.org.id })
    .select()
    .single()

  if (error) {
    console.error(`[resources POST] ${table}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: row })
}

export async function PUT(request: Request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { table, id, data } = await request.json()
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership before update
  const { data: existing } = await admin
    .from(table)
    .select('organization_id')
    .eq('id', id)
    .single()

  // For school_groups, verify via class
  if (table === 'school_groups') {
    const { data: group } = await admin
      .from('school_groups')
      .select('school_classes(organization_id)')
      .eq('id', id)
      .single()
    const orgId = (group as any)?.school_classes?.organization_id
    if (orgId !== auth.ctx.org.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if ((existing as any)?.organization_id !== auth.ctx.org.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from(table).update(data).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { table, id } = await request.json()
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}