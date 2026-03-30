// POST /api/schedules/[id]/school-setup
// Saves schedule_config + curriculum_items.
// Called by SchoolSetupClient on save/generate.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No org' }, { status: 401 })

  const { id: scheduleId } = await params
  const { config, curriculum } = await request.json()
  const admin = createAdminClient()

  // Verify schedule belongs to org
  const { data: schedule } = await admin
    .from('schedules').select('id').eq('id', scheduleId)
    .eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Upsert schedule_config
  await admin.from('schedule_configs').delete().eq('schedule_id', scheduleId)
  const { error: configErr } = await admin.from('schedule_configs').insert({
    schedule_id:      scheduleId,
    days_per_week:    config.days,
    slots_per_day:    config.slots,
    slot_duration:    config.slotDuration,
    first_slot_start: config.firstSlot,
    soft_rules:       config.softRules,
  })
  if (configErr) return NextResponse.json({ error: configErr.message }, { status: 500 })
  console.log('[school-setup] saved soft_rules:', JSON.stringify(config.softRules))

  // Replace curriculum_items
  await admin.from('curriculum_items').delete().eq('schedule_id', scheduleId)
  if (curriculum.length > 0) {
    const { error: currErr } = await admin.from('curriculum_items').insert(
      curriculum.map((item: any) => ({
        schedule_id:       scheduleId,
        class_id:          item.class_id,
        subject_id:        item.subject_id,
        teacher_id:        item.teacher_id,
        weekly_hours:      item.weekly_hours,
        lesson_pattern:    item.lesson_pattern ?? null,
        preferred_room_id: item.preferred_room_id ?? null,
      }))
    )
    if (currErr) return NextResponse.json({ error: currErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}