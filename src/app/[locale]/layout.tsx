// Locale layout — wraps all pages under /ro/** and /en/**.
// Provides translations (NextIntlClientProvider) and theme (ThemeProvider).
// Used by: all pages inside src/app/[locale]/.

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import '../globals.css'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}
