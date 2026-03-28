// Resources page — for education organizations.
// Server component shell that loads org context.
// The actual CRUD is in the client component ResourcesClient.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getSchoolResources } from '@/lib/dal/school'
import { ResourcesClient } from '@/components/resources/ResourcesClient'

interface Props { params: Promise<{ locale: string }> }

export default async function ResourcesPage({ params }: Props) {
  const { locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  // Redirect business orgs that accidentally land here
  if (ctx.org.org_type !== 'education') {
    redirect(`/${locale}/employees`)
  }

  const resources = await getSchoolResources(ctx.org.id)

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>
          Resurse
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Definește resursele instituției — disponibile la crearea oricărui orar.
        </p>
      </div>
      <ResourcesClient
        orgId={ctx.org.id}
        initialResources={resources}
      />
    </div>
  )
}
