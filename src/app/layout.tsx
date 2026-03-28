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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
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