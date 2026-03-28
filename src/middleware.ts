// Next.js middleware — runs on every request before page rendering.
// Execution order:
//   1. Skip /api/* routes (no locale, no auth)
//   2. Skip /auth/callback routes
//   3. Guard: if Supabase env vars missing, only run i18n
//   4. Refresh Supabase session cookies
//   5. Redirect unauthenticated users to /login
//   6. Redirect authenticated users away from login/register
//   7. Apply next-intl locale routing (/ → /ro)
// Used by: Next.js — runs automatically on all matched routes.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/auth/callback',
  '/privacy',
  '/terms',
  '/contact',
  '/setup',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Skip API routes entirely — no locale prefix, no auth redirect ──────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ── Skip auth callback routes ──────────────────────────────────────────────
  if (pathname.includes('/auth/callback')) {
    return NextResponse.next()
  }

  // Strip locale prefix for path matching
  const pathWithoutLocale = pathname.replace(/^\/(ro|en)/, '') || '/'
  const locale = pathname.startsWith('/en') ? 'en' : 'ro'

  // Check if path is public (no auth required)
  const isPublic = PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p))
    || pathWithoutLocale === '/'

  // ── Step 3: Guard against missing environment variables ─────────────────────
  // If Supabase keys are missing (e.g. first deploy), skip auth and just do i18n.
  // Guard: if env vars missing, just run i18n
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return intlMiddleware(request) ?? NextResponse.next()
  }

  // Handle Supabase session refresh
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as any)
        )
      },
    },
  })

  // ── Step 4: Refresh Supabase session and get current user ───────────────────
  // This also refreshes the session token if it's about to expire.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    return intlMiddleware(request) ?? NextResponse.next()
  }

  // ── Step 5: Auth guards ─────────────────────────────────────────────────────
  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  // ── Step 6: Locale routing ──────────────────────────────────────────────────
  // Adds locale prefix to URL if missing (/ → /ro).
  // Apply i18n middleware for locale routing
  const intlResponse = intlMiddleware(request)
  if (intlResponse) return intlResponse

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip static files, but include everything else including /api
    // API routes are handled explicitly at the top of middleware
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}