// Constraints page — server shell.
// Loads employees, shift definitions, existing constraints via DAL.
// Passes to ConstraintsClient for interactive form.

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getEmployees } from '@/lib/dal/employees'
import { createAdminClient } from '@/lib/supabase/server'
import { ConstraintsClient } from '@/components/schedule/ConstraintsClient'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function ConstraintsPage({ params }: Props) {
  const { id: scheduleId, locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const admin = createAdminClient()

  // Verify schedule belongs to this org
  const { data: schedule } = await admin
    .from('schedules').select('id, name')
    .eq('id', scheduleId).eq('organization_id', ctx.org.id).single()
  if (!schedule) notFound()

  const [employees, shiftsRes, constraintsRes] = await Promise.all([
    getEmployees(ctx.org.id),
    admin.from('shift_definitions').select('*').eq('organization_id', ctx.org.id),
    admin.from('constraints').select('*').eq('schedule_id', scheduleId),
  ])

  return (
    <ConstraintsClient
      scheduleId={scheduleId}
      locale={locale}
      employees={employees}
      shiftDefs={shiftsRes.data ?? []}
      initialConstraints={constraintsRes.data ?? []}
    />
  )
}