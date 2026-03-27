// Dashboard shell layout — renders sidebar + main content area.
// Guards: redirects to /login if not authenticated, to /setup if org is missing.
// Shows TrialBanner when trial has 7 or fewer days remaining.
// Used by: all pages inside (dashboard)/.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/shared/SidebarNav'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { trialDaysRemaining, isTrialActive } from '@/lib/stripe/index'
import { headers } from 'next/headers'

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

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const org = membership?.organizations as any

  // No organization yet — send to setup
  if (!org) {
    redirect(`/${locale}/setup`)
  }

  const trialDays = trialDaysRemaining(org.trial_ends_at)
  const trialActive = isTrialActive(org.trial_ends_at)

  return (
    <div className="flex h-screen" style={{ background: '#f8f9fc' }}>
      <SidebarNav profile={profile as any} organization={org} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {trialActive && trialDays <= 7 && <TrialBanner daysRemaining={trialDays} />}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
