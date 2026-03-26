import { NextResponse } from 'next/server'
import { stripe, getPlanByPriceId } from '@/lib/stripe/config'
import { createAdminClient } from '@/lib/supabase/client'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      // Get subscription details to find price
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id
      const plan = getPlanByPriceId(priceId ?? '')

      await admin
        .from('organizations')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          plan: (plan?.id ?? 'free') as any,
          max_employees: plan?.maxEmployees ?? 10,
          subscription_ends_at: null,
          trial_ends_at: null, // Clear trial when subscribing
        })
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const priceId = subscription.items.data[0]?.price.id
      const plan = getPlanByPriceId(priceId ?? '')

      const status = subscription.status
      const isActive = ['active', 'trialing'].includes(status)

      await admin
        .from('organizations')
        .update({
          plan: isActive ? ((plan?.id ?? 'free') as any) : 'free',
          max_employees: isActive ? (plan?.maxEmployees ?? 10) : 10,
          stripe_price_id: priceId,
          subscription_ends_at: !isActive
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_subscription_id', subscription.id)

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      await admin
        .from('organizations')
        .update({
          plan: 'free',
          max_employees: 10,
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_ends_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // Could send email notification here
      console.warn('Payment failed for customer:', invoice.customer)
      break
    }
  }

  return NextResponse.json({ received: true })
}

// Disable body parsing — Stripe needs the raw body for signature verification
// In App Router, body parsing is disabled by default when using request.text()
export const dynamic = 'force-dynamic'
