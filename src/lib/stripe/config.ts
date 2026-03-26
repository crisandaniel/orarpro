import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    maxEmployees: 10,
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    features: [
      'employees10',
      'schedules',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    maxEmployees: 25,
    priceMonthly: 29,
    priceYearly: 278,  // 20% off
    stripePriceMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    features: [
      'employees25',
      'schedules',
      'export',
      'aiSuggestions',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxEmployees: 75,
    priceMonthly: 69,
    priceYearly: 662,  // 20% off
    stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: [
      'employees75',
      'schedules',
      'export',
      'aiSuggestions',
      'multiLocation',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    maxEmployees: 999999,
    priceMonthly: 149,
    priceYearly: 1430,  // 20% off
    stripePriceMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    features: [
      'employeesUnlimited',
      'schedules',
      'export',
      'aiSuggestions',
      'multiLocation',
      'support',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlanById(planId: string) {
  return PLANS[planId as PlanId] ?? PLANS.free
}

export function getPlanByPriceId(priceId: string) {
  return Object.values(PLANS).find(
    (plan) =>
      plan.stripePriceMonthly === priceId ||
      plan.stripePriceYearly === priceId
  )
}

// ─── Trial configuration ──────────────────────────────────────────────────────

export const TRIAL_DAYS = 14

export function isTrialActive(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) > new Date()
}

export function trialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
