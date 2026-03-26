import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// ─── Plan Configuration ───────────────────────────────────────────────────────

export const PLANS = {
  free: {
    name: 'Free',
    maxEmployees: 10,
    maxSchedules: 3,
    features: ['basic_scheduling', 'pdf_export', 'holidays'],
    monthlyPrice: 0,
    yearlyPrice: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
  },
  starter: {
    name: 'Starter',
    maxEmployees: 25,
    maxSchedules: 10,
    features: ['basic_scheduling', 'pdf_export', 'holidays', 'constraints', 'ai_suggestions'],
    monthlyPrice: 29,
    yearlyPrice: 290,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
  },
  pro: {
    name: 'Pro',
    maxEmployees: 75,
    maxSchedules: -1, // unlimited
    features: ['basic_scheduling', 'pdf_export', 'holidays', 'constraints', 'ai_suggestions', 'multi_location', 'team_access'],
    monthlyPrice: 69,
    yearlyPrice: 690,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  business: {
    name: 'Business',
    maxEmployees: -1, // unlimited
    maxSchedules: -1,
    features: ['basic_scheduling', 'pdf_export', 'holidays', 'constraints', 'ai_suggestions', 'multi_location', 'team_access', 'api_access', 'priority_support'],
    monthlyPrice: 149,
    yearlyPrice: 1490,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
  },
} as const

export type PlanKey = keyof typeof PLANS

// ─── Trial Configuration ──────────────────────────────────────────────────────

export const TRIAL_DAYS = 14

// ─── Helper: check if org can add more employees ──────────────────────────────

export function canAddEmployee(currentCount: number, plan: PlanKey): boolean {
  const limit = PLANS[plan].maxEmployees
  if (limit === -1) return true
  return currentCount < limit
}

// ─── Helper: check if org is on active paid plan or trial ────────────────────

export function isActivePlan(org: {
  plan: string
  trial_ends_at: string | null
  subscription_ends_at: string | null
}): boolean {
  if (org.plan === 'free') return true

  const now = new Date()

  // Active subscription
  if (org.subscription_ends_at && new Date(org.subscription_ends_at) > now) return true

  // Active trial
  if (org.trial_ends_at && new Date(org.trial_ends_at) > now) return true

  return false
}

// ─── Create Stripe checkout session ──────────────────────────────────────────

export async function createCheckoutSession({
  customerId,
  priceId,
  organizationId,
  successUrl,
  cancelUrl,
}: {
  customerId: string
  priceId: string
  organizationId: string
  successUrl: string
  cancelUrl: string
}) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { organization_id: organizationId },
    },
    metadata: { organization_id: organizationId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  })
}

// ─── Create Stripe customer portal session ────────────────────────────────────

export async function createPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

// ─── Helper: get plan by Stripe price ID ─────────────────────────────────────

export function getPlanByPriceId(priceId: string): typeof PLANS[PlanKey] | undefined {
  return Object.values(PLANS).find(
    (plan) =>
      plan.stripePriceIdMonthly === priceId ||
      plan.stripePriceIdYearly === priceId
  )
}

// ─── Helper: trial days remaining ────────────────────────────────────────────

export function trialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ─── Helper: is trial active ──────────────────────────────────────────────────

export function isTrialActive(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) > new Date()
}
