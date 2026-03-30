// school-setup/page.tsx — server shell.
// Loads resources + existing config/curriculum/lessons → SchoolSetupClient.

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getSchoolResources, getScheduleConfig, getCurriculumItems, getLessons } from '@/lib/dal/school'
import { SchoolSetupClient } from '@/components/schedule/SchoolSetupClient'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function SchoolSetupPage({ params }: Props) {
  const { id, locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const admin = createAdminClient()

  const { data: schedule } = await admin
    .from('schedules').select('id, name')
    .eq('id', id).eq('organization_id', ctx.org.id).single()
  if (!schedule) notFound()

  // Load org time config
  const { data: orgData } = await admin
    .from('organizations').select('days_per_week, slots_per_day').eq('id', ctx.org.id).single()

  const [resources, config, curriculum, lessons] = await Promise.all([
    getSchoolResources(ctx.org.id),
    getScheduleConfig(id),
    getCurriculumItems(id),
    getLessons(id),
  ])

  return (
    <SchoolSetupClient
      scheduleId={id}
      scheduleName={schedule.name}
      locale={locale}
      resources={resources}
      existingConfig={config as any}
      existingCurriculum={curriculum as any}
      existingLessons={lessons}
      existingSolverUsed={(config as any)?.solver_used ?? undefined}
      daysPerWeek={orgData?.days_per_week ?? 5}
      slotsPerDay={orgData?.slots_per_day ?? 8}
    />
  )
}
