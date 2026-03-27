// Yellow banner shown at the top of the dashboard when trial has 7 or fewer days left.
// Links to /billing for upgrade.
// Used by: (dashboard)/layout.tsx.


import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 px-6 py-2.5">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">
            Your free trial ends in <strong>{daysRemaining} days</strong>.
            Upgrade to keep your schedules and data.
          </p>
        </div>
        <Link
          href="/billing"
          className="shrink-0 text-sm font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline ml-4"
        >
          Upgrade now
        </Link>
      </div>
    </div>
  )
}
