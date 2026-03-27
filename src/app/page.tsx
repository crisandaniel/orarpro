// Root page — redirects / to /ro (default locale).
// Used by: Next.js router when user visits the bare domain root.

import { redirect } from 'next/navigation'

// Redirect root to default locale
// next-intl middleware handles this for most cases,
// but this catches any edge cases
export default function RootPage() {
  redirect('/ro')
}
