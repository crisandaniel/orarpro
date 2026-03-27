// Server-side Supabase clients for Server Components and API route handlers.
// createServerSupabaseClient(): session from cookies. Use for auth checks + SELECT.
// createAdminClient(): service role key, bypasses RLS. Use in API routes for writes.
// PATTERN: verify identity with createServerSupabaseClient, write with createAdminClient.
// Used by: all server components and API routes.

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ─── Server client (for Server Components and API routes) ─────────────────────
// Uses cookies for session management

// ── Client for Server Components and API routes ──────────────────────────────
// Reads session from cookies. Use for: auth checks (getUser), SELECT queries.
// Note: cookies() from next/headers is read-only in route handlers —
// the setAll handler silently fails there (session refresh handled by middleware).
  export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            )
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}

// ─── Admin client (bypasses RLS) ─────────────────────────────────────────────
// Use ONLY in server-side API routes and webhook handlers
// Never expose to the client

// ── Admin client — bypasses Row Level Security (RLS) ─────────────────────────
// Use ONLY server-side in API routes for INSERT/UPDATE/DELETE operations.
// Never expose this client or the service role key to the browser.
// Typical pattern: use createServerSupabaseClient() to verify WHO the user is,
// then use createAdminClient() to perform the privileged database operation.
  export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
