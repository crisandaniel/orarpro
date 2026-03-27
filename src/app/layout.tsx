// Root HTML shell required by Next.js App Router.
// Provides <html> and <body> tags. Providers are in [locale]/layout.tsx.
// Used by: Next.js — wraps every page in the app.

import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'OrarPro — Smart Scheduling',
    template: '%s | OrarPro',
  },
  description: 'Schedule generator for HoReCa, factories, schools and retail',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
