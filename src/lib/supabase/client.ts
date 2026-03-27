// Browser Supabase client — for use in 'use client' components only.
// Singleton to avoid creating multiple clients per render.
// Cookie-based storage ensures PKCE code verifier is accessible server-side.
// Used by: all client components needing auth or DB access.

import { createBrowserClient } from '@supabase/ssr'

// ─── Browser client (for use in 'use client' components only) ─────────────────
// Singleton pattern — reuse same instance to preserve auth state

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        // Store in cookies so server-side callback can read the code verifier
        storage: {
          getItem: (key: string) => {
            if (typeof document === 'undefined') return null
            const cookies = document.cookie.split('; ')
            const cookie = cookies.find(c => c.startsWith(`${key}=`))
            return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
          },
          setItem: (key: string, value: string) => {
            if (typeof document === 'undefined') return
            const maxAge = 60 * 60 * 24 // 24 hours
            document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
          },
          removeItem: (key: string) => {
            if (typeof document === 'undefined') return
            document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
          },
        },
      },
    }
  )

  return client
}
