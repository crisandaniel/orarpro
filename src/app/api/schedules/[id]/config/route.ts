// PATCH /api/schedules/[id]/config — updates generation_config and slots_per_day.
// Used by: ConstraintsPanel "Salvează config" button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { generationConfig, slots } = await request.json()

  // Verify ownership
  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules').select('id')
    .eq('id', id).eq('organization_id', ctx.org.id).single()
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update generation config
  const { error: configError } = await admin
    .from('schedules')
    .update({
      generation_config: {
        min_employees_per_shift: generationConfig.min_employees_per_shift,
        max_consecutive_days: generationConfig.max_consecutive_days,
        min_rest_hours_between_shifts: generationConfig.min_rest_hours_between_shifts,
        max_weekly_hours: generationConfig.max_weekly_hours,
        max_night_shifts_per_week: generationConfig.max_night_shifts_per_week,
        enforce_legal_limits: generationConfig.enforce_legal_limits,
        balance_shift_distribution: generationConfig.balance_shift_distribution,
        shift_consistency: generationConfig.shift_consistency ?? 2,
      },
    })
    .eq('id', id)

  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 })

  // Update slots per shift
  if (slots && slots.length > 0) {
    for (const ss of slots) {
      await admin
        .from('schedule_shifts')
        .update({ slots_per_day: ss.slots_per_day })
        .eq('schedule_id', id)
        .eq('shift_definition_id', ss.shift_definition_id)
    }
  }

  return NextResponse.json({ success: true })
}
