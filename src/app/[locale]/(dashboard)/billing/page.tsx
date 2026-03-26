import { createServerSupabaseClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { PLANS, trialDaysRemaining, isTrialActive } from '@/lib/stripe/config'
import { Check } from 'lucide-react'
import { UpgradeButton } from '@/components/billing/UpgradeButton'

export default async function BillingPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', user.id)
    .single()

  const org = membership?.organizations as any
  const currentPlan = org?.plan ?? 'free'
  const trialDays = trialDaysRemaining(org?.trial_ends_at)
  const trialActive = isTrialActive(org?.trial_ends_at)
  const employeeCount = 0 // TODO: fetch actual count

  const plans = [
    { ...PLANS.free, features: ['Up to 10 employees', 'Unlimited schedules', 'All constraint types'] },
    { ...PLANS.starter, features: ['Up to 25 employees', 'Unlimited schedules', 'AI suggestions', 'PDF export'] },
    { ...PLANS.pro, features: ['Up to 75 employees', 'Everything in Starter', 'Multiple locations', 'Priority support'] },
    { ...PLANS.business, features: ['Unlimited employees', 'Everything in Pro', 'Custom constraints', 'Dedicated support'] },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Billing & Plans</h1>
        {trialActive && (
          <p className="text-amber-600 text-sm mt-1">
            Your free trial ends in {trialDays} days. Upgrade to keep your data.
          </p>
        )}
      </div>

      {/* Current plan */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-xl font-semibold capitalize mt-1">{currentPlan}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Employees</p>
            <p className="text-xl font-semibold mt-1">
              {employeeCount} / {org?.max_employees ?? 10}
            </p>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isPopular = plan.id === 'pro'

          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 p-5 flex flex-col ${
                isPopular
                  ? 'border-indigo-600'
                  : isCurrent
                  ? 'border-green-500'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Popular
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Current
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-semibold">{plan.name}</h3>
                <div className="mt-2">
                  {plan.priceMonthly === 0 ? (
                    <p className="text-2xl font-bold">Free</p>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold">{plan.priceMonthly} RON</span>
                      <span className="text-gray-500 text-sm"> / month</span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {!isCurrent && plan.priceMonthly > 0 && (
                <UpgradeButton
                  planId={plan.id}
                  priceId={plan.stripePriceMonthly ?? ''}
                  organizationId={org?.id}
                />
              )}

              {isCurrent && plan.priceMonthly === 0 && (
                <p className="text-xs text-center text-gray-400">Your current plan</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        All prices in RON. Cancel anytime. 14-day free trial on paid plans.
      </p>
    </div>
  )
}
