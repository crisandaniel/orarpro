// Browser Supabase client — for use in 'use client' components only.
// Reads the Supabase session from cookies (where server.ts saves it)
// and manually sets the session on the client.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Helper: assembles chunked cookies (.0, .1) into a single value
export function getSessionFromCookies(): { access_token: string; refresh_token: string } | null {
  if (typeof document === 'undefined') return null

  const cookies: Record<string, string> = {}
  document.cookie.split('; ').filter(Boolean).forEach(c => {
    const [name, ...rest] = c.split('=')
    cookies[name] = decodeURIComponent(rest.join('='))
  })

  // Find the auth token key (format: sb-<project>-auth-token)
  const prefix = Object.keys(cookies).find(k => k.match(/^sb-.+-auth-token\.0$/))
  if (!prefix) return null

  const base = prefix.replace('.0', '')
  const chunk0 = cookies[`${base}.0`] ?? ''
  const chunk1 = cookies[`${base}.1`] ?? ''

  try {
    const raw = JSON.parse(chunk0 + chunk1)
    if (raw?.access_token && raw?.refresh_token) {
      return { access_token: raw.access_token, refresh_token: raw.refresh_token }
    }
  } catch { /* invalid JSON */ }

  return null
}