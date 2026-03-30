// POST /api/resources   — insert a school resource
// PUT  /api/resources   — update a school resource
// DELETE /api/resources — delete a school resource (with cascade)
//
// Uses createAdminClient() — bypasses RLS, verifies auth server-side.
// Used by: ResourcesClient.tsx
//
// Cascade delete order (FK dependencies):
//   school_lessons → curriculum_items → school_classes/teachers/subjects/rooms

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

const ALLOWED_TABLES = [
  'school_teachers',
  'school_subjects',
  'school_classes',
  'school_rooms',
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

  // Verify ownership
  const { data: existing } = await admin
    .from(table).select('organization_id').eq('id', id).single()
  if ((existing as any)?.organization_id !== auth.ctx.org.id) {
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

  // Cascade delete dependents (FK constraints without ON DELETE CASCADE)
  if (table === 'school_teachers') {
    await admin.from('school_lessons').delete().eq('teacher_id', id)
    await admin.from('curriculum_items').delete().eq('teacher_id', id)
  }
  if (table === 'school_subjects') {
    await admin.from('school_lessons').delete().eq('subject_id', id)
    await admin.from('curriculum_items').delete().eq('subject_id', id)
  }
  if (table === 'school_classes') {
    await admin.from('school_lessons').delete().eq('class_id', id)
    await admin.from('curriculum_items').delete().eq('class_id', id)
  }
  if (table === 'school_rooms') {
    // Null out room references — lessons stay
    await admin.from('school_lessons').update({ room_id: null }).eq('room_id', id)
    await admin.from('curriculum_items').update({ preferred_room_id: null }).eq('preferred_room_id', id)
    // Null out homeroom reference on classes
    await admin.from('school_classes').update({ homeroom_id: null }).eq('homeroom_id', id)
  }

  const { error } = await admin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
