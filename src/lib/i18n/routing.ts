// next-intl routing configuration.
// locales: ['ro', 'en'] — supported languages.
// defaultLocale: 'ro' — used when no locale prefix in URL.
// localePrefix: 'always' — every URL must have /ro/ or /en/ prefix.
// localeDetection: false — ignore browser Accept-Language header,
//                          always use defaultLocale for bare URLs.
// Used by: middleware.ts, navigation.ts.

// n

import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ro', 'en'],
  defaultLocale: 'ro',
  localePrefix: 'always',
  // Don't detect locale from browser Accept-Language header
  // Always use defaultLocale ('ro') when no prefix in URL
  localeDetection: false,
})
