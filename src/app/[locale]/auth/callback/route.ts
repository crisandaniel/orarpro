// OAuth callback handler for Google login (/ro/auth/callback, /en/auth/callback).
// Exchanges OAuth code for a Supabase session, writes session cookies to response.
// IMPORTANT: creates its own Supabase client (not createServerSupabaseClient) so
// session cookies are set on the NextResponse object — required in route handlers.
// Used by: Supabase OAuth redirect after Google login.

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('redirectTo') ?? `/${locale}/dashboard`

  // Ensure destination has locale prefix
  const destination = next.startsWith(`/${locale}`)
    ? next
    : `/${locale}${next.startsWith('/') ? next : `/${next}`}`

  if (!code) {
    console.error('Auth callback: no code in request')
    return NextResponse.redirect(`${origin}/${locale}/login?error=no_code`)
  }

  // Create a mutable response to attach cookies to
  const successUrl = new URL(destination, origin)
  const response = NextResponse.redirect(successUrl)

  // Create Supabase client using the SAME cookie pattern as middleware
  // This ensures PKCE code verifier (stored in cookies by @supabase/ssr browser client)
  // is readable here and the new session cookies are written to the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read all cookies from the incoming request
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Write session cookies to both request (for further reads) and response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, {
              ...options as any,
              // Ensure cookies work across the site
              sameSite: 'lax',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth callback exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      `${origin}/${locale}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return response
}
