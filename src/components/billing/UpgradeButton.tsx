'use client'

// Client button that initiates Stripe Checkout when clicked.
// Calls POST /api/billing/create-checkout, then redirects to Stripe checkout page.
// Used by: billing/page.tsx for each paid plan card.



import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface UpgradeButtonProps {
  planId: string
  priceId: string
  organizationId: string
}

export function UpgradeButton({ planId, priceId, organizationId }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    if (!priceId) {
      toast.error('Price not configured. Please contact support.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, organizationId }),
      })

      const { sessionId, error } = await res.json()

      if (error || !sessionId) {
        toast.error(error ?? 'Failed to create checkout session')
        return
      }

      const stripe = await stripePromise
      await stripe?.redirectToCheckout({ sessionId })
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      Upgrade to {planId}
    </button>
  )
}
