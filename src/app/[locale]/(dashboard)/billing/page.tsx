// Billing page — current plan info + 4 plan cards with features and prices.
// Free plan is permanent (no expiry). Paid plans have 14-day trials.
// UpgradeButton triggers Stripe Checkout.
// Used by: nav link 'Abonament'.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PLANS, trialDaysRemaining, isTrialActive } from '@/lib/stripe/index'
import { Check } from 'lucide-react'
import { UpgradeButton } from '@/components/billing/UpgradeButton'
import { getTranslations } from 'next-intl/server'

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('billing')
  const tf = await getTranslations('billing.features')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: membership } = await supabase
    .from('organization_members').select('organizations(*)').eq('user_id', user.id).single()

  const org = membership?.organizations as any
  const currentPlan = org?.plan ?? 'free'
  const trialDays = trialDaysRemaining(org?.trial_ends_at)
  const trialActive = isTrialActive(org?.trial_ends_at)

  const { count: employeeCount } = await supabase
    .from('employees').select('id', { count: 'exact' })
    .eq('organization_id', org?.id ?? '').eq('is_active', true)

  const plans = [
    {
      id: 'free', name: t('free'), price: '0', period: '',
      desc: t('forSmall'),
      features: [tf('employees10'), tf('schedules'), tf('allConstraints'), tf('holidays')],
      stripePriceIdMonthly: null,
    },
    {
      id: 'starter', name: t('starter'), price: '29', period: '/lună',
      desc: t('forGrowing'),
      features: [tf('employees25'), tf('schedules'), tf('aiSuggestions'), tf('export')],
      stripePriceIdMonthly: PLANS.starter.stripePriceIdMonthly,
    },
    {
      id: 'pro', name: t('pro'), price: '69', period: '/lună',
      desc: t('forLarge'),
      features: [tf('employees75'), tf('aiSuggestions'), tf('multiLocation'), tf('support')],
      stripePriceIdMonthly: PLANS.pro.stripePriceIdMonthly,
    },
    {
      id: 'business', name: t('business'), price: '149', period: '/lună',
      desc: t('unlimited'),
      features: [tf('employeesUnlimited'), tf('api'), tf('dedicatedManager'), tf('support')],
      stripePriceIdMonthly: PLANS.business.stripePriceIdMonthly,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{t('title')}</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{t('subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl p-5 mb-6 flex items-center justify-between"
        style={{ border: '0.5px solid #e5e7eb' }}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>
            {t('currentPlan')}
          </p>
          <p className="text-xl font-medium capitalize" style={{ color: '#111827' }}>
            {plans.find(p => p.id === currentPlan)?.name ?? currentPlan}
          </p>
          {trialActive && currentPlan !== 'free' ? (
            <p className="text-xs mt-1" style={{ color: '#d97706' }}>
              {t('trialLeft', { days: trialDays })}
            </p>
          ) : currentPlan === 'free' ? (
            <p className="text-xs mt-1" style={{ color: '#059669' }}>{t('freePermanent')}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>{t('activeEmployees')}</p>
          <p className="text-xl font-medium" style={{ color: '#111827' }}>
            {employeeCount ?? 0} / {org?.max_employees ?? 10}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isPopular = plan.id === 'pro'
          return (
            <div key={plan.id} className="bg-white rounded-xl p-5 flex flex-col relative"
              style={{ border: isPopular ? '2px solid #2563eb' : isCurrent ? '2px solid #059669' : '0.5px solid #e5e7eb' }}>

              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: '#2563eb', color: '#fff' }}>{t('popular')}</div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: '#059669', color: '#fff' }}>{t('activeBadge')}</div>
              )}

              <div className="mb-3">
                <h3 className="font-medium text-sm" style={{ color: '#111827' }}>{plan.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{plan.desc}</p>
              </div>

              <div className="flex items-baseline gap-0.5 mb-1">
                <span className="text-2xl font-medium" style={{ color: '#111827' }}>{plan.price}</span>
                {plan.price !== '0' && <span className="text-xs" style={{ color: '#9ca3af' }}>RON</span>}
                <span className="text-xs ml-0.5" style={{ color: '#9ca3af' }}>{plan.period}</span>
              </div>
              {plan.price === '0' && (
                <p className="text-xs mb-3" style={{ color: '#059669' }}>{t('freePermanentBadge')}</p>
              )}

              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: '#374151' }}>
                    <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#059669' }} />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && plan.price !== '0' && plan.stripePriceIdMonthly && (
                <UpgradeButton planId={plan.id} priceId={plan.stripePriceIdMonthly} organizationId={org?.id} />
              )}
              {isCurrent && (
                <p className="text-xs text-center" style={{ color: '#9ca3af' }}>{t('yourPlan')}</p>
              )}
              {!isCurrent && plan.price === '0' && (
                <p className="text-xs text-center" style={{ color: '#9ca3af' }}>{t('downgrade')}</p>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-center mt-5" style={{ color: '#9ca3af' }}>{t('priceNote')}</p>
    </div>
  )
}
