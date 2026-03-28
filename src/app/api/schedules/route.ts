// POST /api/schedules — creates a new schedule record (status: draft).
// Uses getOrgContext() to get the active organization — handles multi-org users.
// Used by: schedules/new/page.tsx (step 1 of wizard).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getOrgContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No organization found' }, { status: 400 })

  const body = await request.json()
  const { name, type, startDate, endDate, workingDays, includeHolidays, countryCode } = body

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: schedule, error } = await admin
    .from('schedules')
    .insert({
      organization_id: ctx.org.id,
      name,
      type: type || 'shifts',
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays || [1, 2, 3, 4, 5],
      include_holidays: includeHolidays ?? true,
      country_code: countryCode || 'RO',
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single()

  if (error || !schedule) {
    console.error('Schedule creation error:', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to create schedule' }, { status: 500 })
  }

  return NextResponse.json({ success: true, scheduleId: schedule.id })
}