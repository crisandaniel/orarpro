// POST /api/billing/create-checkout — creates a Stripe Checkout session.
// Verifies user is owner/admin before proceeding.
// Gets or creates a Stripe customer for the organization.
// Includes 14-day trial on first subscription.
// Used by: UpgradeButton component on billing page.

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/index'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId, organizationId } = await request.json()

  if (!priceId || !organizationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify user is owner of the organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Get or create Stripe customer
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', organizationId)
    .single()

  let customerId = org?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org?.name,
      metadata: { organizationId, userId: user.id },
    })
    customerId = customer.id

    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', organizationId)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
    },
    success_url: `${appUrl}/billing?success=true`,
    cancel_url: `${appUrl}/billing?canceled=true`,
    metadata: { organizationId },
  })

  return NextResponse.json({ sessionId: session.id })
}
