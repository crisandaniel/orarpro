// Dashboard shell layout — server component.
// Loads org context once via DAL, provides it to all client components via OrgProvider.
// Guards: → /login if not authenticated, → /setup if no orgs.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { OrgProvider } from '@/lib/context/OrgContext'
import { SidebarNav } from '@/components/shared/SidebarNav'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { trialDaysRemaining, isTrialActive } from '@/lib/stripe/index'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const trialDays = trialDaysRemaining(ctx.org.trial_ends_at)
  const trialActive = isTrialActive(ctx.org.trial_ends_at)

  return (
    <OrgProvider value={ctx}>
      <div className="flex h-screen" style={{ background: '#f8f9fc' }}>
        <SidebarNav ctx={ctx} locale={locale} />
        <div className="flex-1 flex flex-col overflow-hidden">
          {trialActive && trialDays <= 7 && <TrialBanner daysRemaining={trialDays} />}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </OrgProvider>
  )
}
