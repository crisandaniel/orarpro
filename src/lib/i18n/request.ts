// next-intl server configuration — loads translation JSON for the current request.
// Falls back to 'ro' if locale is missing or invalid.
// Configured in next.config.mjs via createNextIntlPlugin.
// Used by: Next.js per-request context (transparent, no direct calls needed).

// n

import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../../messages/${locale}.json`)).default,
  }
})
