// School setup page — server shell loads org resources, client handles wizard.

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getSchoolResources } from '@/lib/dal/school'
import { createAdminClient } from '@/lib/supabase/server'
import { SchoolSetupClient } from '@/components/schedule/SchoolSetupClient'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function SchoolSetupPage({ params }: Props) {
  const { id, locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  // Verify schedule belongs to this org
  const admin = createAdminClient()
  const { data: schedule } = await admin
    .from('schedules').select('id, name').eq('id', id)
    .eq('organization_id', ctx.org.id).single()
  if (!schedule) notFound()

  // Load existing config if editing
  const { data: existingConfig } = await admin
    .from('school_configs').select('*').eq('schedule_id', id).single()

  // Load existing assignments
  const { data: existingAssignments } = await admin
    .from('school_assignments').select('*').eq('schedule_id', id)

  // Load org resources — defined in /resources page
  const resources = await getSchoolResources(ctx.org.id)

  return (
    <SchoolSetupClient
      scheduleId={id}
      scheduleName={schedule.name}
      locale={locale}
      resources={resources}
      existingConfig={existingConfig}
      existingAssignments={existingAssignments ?? []}
    />
  )
}
