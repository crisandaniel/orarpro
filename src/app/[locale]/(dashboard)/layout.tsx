import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/shared/SidebarNav'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { trialDaysRemaining, isTrialActive } from '@/lib/stripe/config'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load profile and active organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const org = memberships?.organizations as any
  const trialDays = org ? trialDaysRemaining(org.trial_ends_at) : 0
  const trialActive = org ? isTrialActive(org.trial_ends_at) : false

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <SidebarNav
        profile={profile}
        organization={org}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {trialActive && trialDays <= 7 && (
          <TrialBanner daysRemaining={trialDays} />
        )}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
