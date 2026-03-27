// POST /api/schedules/[id]/setup — saves shift definitions and generation config.
// Steps: insert shift_definitions, link to schedule via schedule_shifts, update config.
// Uses createAdminClient() to bypass RLS.
// Used by: schedules/[id]/setup/page.tsx (step 2 of wizard).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

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
  const { shifts, generationConfig } = body

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ error: 'At least one shift is required' }, { status: 400 })
  }

  // Verify schedule belongs to user's organization
  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: schedule } = await admin
    .from('schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('organization_id', membership.organization_id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  // Insert shift definitions
  const { data: insertedShifts, error: shiftError } = await admin
    .from('shift_definitions')
    .insert(
      shifts.map((s: any) => ({
        organization_id: membership.organization_id,
        name: s.name,
        shift_type: s.shift_type,
        start_time: s.start_time,
        end_time: s.end_time,
        crosses_midnight: s.crosses_midnight,
        color: s.color,
      }))
    )
    .select()

  if (shiftError || !insertedShifts) {
    console.error('Shift insert error:', shiftError)
    return NextResponse.json({ error: shiftError?.message ?? 'Failed to save shifts' }, { status: 500 })
  }

  // Link shifts to schedule
  const { error: linkError } = await admin
    .from('schedule_shifts')
    .insert(
      insertedShifts.map((s: any, i: number) => ({
        schedule_id: scheduleId,
        shift_definition_id: s.id,
        slots_per_day: shifts[i].slots_per_day,
      }))
    )

  if (linkError) {
    console.error('Schedule shift link error:', linkError)
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  // Update generation config
  const { error: configError } = await admin
    .from('schedules')
    .update({
      generation_config: {
        min_employees_per_shift: generationConfig.min_employees_per_shift,
        max_consecutive_days: generationConfig.max_consecutive_days,
        min_rest_hours_between_shifts: generationConfig.min_rest_hours,
        max_weekly_hours: generationConfig.max_weekly_hours,
        max_night_shifts_per_week: generationConfig.max_night_shifts_per_week,
        enforce_legal_limits: generationConfig.enforce_legal_limits,
        balance_shift_distribution: generationConfig.balance_distribution,
      },
    })
    .eq('id', scheduleId)

  if (configError) {
    console.error('Config update error:', configError)
    return NextResponse.json({ error: configError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
