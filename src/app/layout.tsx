// Root HTML shell required by Next.js App Router.
// Provides <html> and <body> tags. Providers are in [locale]/layout.tsx.
// Google Analytics via @next/third-parties (no performance penalty).
// Used by: Next.js — wraps every page in the app.

import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { GoogleAnalytics } from '@next/third-parties/google'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ''

export const metadata: Metadata = {
  title: {
    default: 'OrarPro — Generator de Orar Inteligent',
    template: '%s | OrarPro',
  },
  description: 'Generator de orar automat pentru școli, licee și universități. CP-SAT solver, constrângeri configurabile, export PDF.',
  keywords: ['generator orar', 'orar școală', 'orar liceu', 'planificare orar', 'timetable generator', 'school schedule'],
  authors: [{ name: 'OrarPro' }],
  creator: 'OrarPro',
  publisher: 'OrarPro',
  metadataBase: new URL('https://www.orarpro.ro'),
  alternates: {
    canonical: '/',
    languages: {
      'ro': '/ro',
      'en': '/en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    alternateLocale: 'en_US',
    url: 'https://www.orarpro.ro',
    siteName: 'OrarPro',
    title: 'OrarPro — Generator de Orar Inteligent',
    description: 'Generator de orar automat pentru școli, licee și universități. CP-SAT solver, constrângeri configurabile, export PDF.',
    images: [
      {
        url: '/og-image.png',  // 1200×630px — de creat
        width: 1200,
        height: 630,
        alt: 'OrarPro — Generator de Orar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrarPro — Generator de Orar Inteligent',
    description: 'Generator de orar automat pentru școli, licee și universități.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
  verification: {
    google: 'G-244L3D68D7',
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
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  )
}