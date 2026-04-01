// POST /api/schedules/[id]/setup — saves shift definitions and generation config.
// SAFE: update shift_definitions existente, insert ture noi.
// Nu șterge niciodată shift_definitions care au asignări.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scheduleId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { shifts, generationConfig, softRules } = body

  if (!shifts || shifts.length === 0)
    return NextResponse.json({ error: 'At least one shift is required' }, { status: 400 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules').select('id')
    .eq('id', scheduleId).eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  // Fetch ture existente (cu id-ul legăturii schedule_shifts)
  const { data: existingLinks } = await admin
    .from('schedule_shifts')
    .select('id, shift_definition_id, slots_per_day')
    .eq('schedule_id', scheduleId)

  const existing = existingLinks ?? []

  // Update sau insert per tură (pe poziție)
  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i]
    const link = existing[i]

    if (link) {
      // Update shift_definition existentă — fără delete, fără cascade
      await admin.from('shift_definitions').update({
        name: s.name, shift_type: s.shift_type,
        start_time: s.start_time, end_time: s.end_time,
        crosses_midnight: s.crosses_midnight, color: s.color,
      }).eq('id', link.shift_definition_id)

      if (link.slots_per_day !== s.slots_per_day) {
        await admin.from('schedule_shifts')
          .update({ slots_per_day: s.slots_per_day })
          .eq('id', link.id)
      }
    } else {
      // Insert tură nouă
      const { data: inserted, error } = await admin
        .from('shift_definitions')
        .insert({
          organization_id: ctx.org.id,
          name: s.name, shift_type: s.shift_type,
          start_time: s.start_time, end_time: s.end_time,
          crosses_midnight: s.crosses_midnight, color: s.color,
        })
        .select('id').single()

      if (error || !inserted)
        return NextResponse.json({ error: error?.message ?? 'Failed to save shift' }, { status: 500 })

      await admin.from('schedule_shifts').insert({
        schedule_id: scheduleId,
        shift_definition_id: inserted.id,
        slots_per_day: s.slots_per_day,
      })
    }
  }

  // Șterge ture eliminate — doar dacă nu au asignări
  if (existing.length > shifts.length) {
    for (const link of existing.slice(shifts.length)) {
      const { count } = await admin
        .from('shift_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('schedule_id', scheduleId)
        .eq('shift_definition_id', link.shift_definition_id)

      if ((count ?? 0) === 0) {
        await admin.from('schedule_shifts').delete().eq('id', link.id)
        await admin.from('shift_definitions').delete().eq('id', link.shift_definition_id)
      }
    }
  }

  // Salvează generation_config cu soft_rules
  const { error: configError } = await admin
    .from('schedules')
    .update({
      generation_config: {
        min_employees_per_shift:       generationConfig?.min_employees_per_shift    ?? 1,
        max_consecutive_days:          generationConfig?.max_consecutive_days       ?? 6,
        min_rest_hours_between_shifts: generationConfig?.min_rest_hours             ?? 11,
        max_weekly_hours:              generationConfig?.max_weekly_hours           ?? 48,
        max_night_shifts_per_week:     generationConfig?.max_night_shifts_per_week ?? 2,
        enforce_legal_limits:          generationConfig?.enforce_legal_limits      ?? true,
        balance_shift_distribution:    generationConfig?.balance_shift_distribution ?? true,
        soft_rules:                    softRules ?? {},
      },
    })
    .eq('id', scheduleId)

  if (configError)
    return NextResponse.json({ error: configError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
