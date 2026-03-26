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
  '/api/billing/webhook', // Stripe webhooks bypass auth
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Strip locale prefix for path matching
  const pathWithoutLocale = pathname.replace(/^\/(ro|en)/, '') || '/'

  // Allow public paths
  const isPublic = PUBLIC_PATHS.some(p => pathWithoutLocale.startsWith(p))

  // Handle Supabase auth session refresh
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user && !isPublic && pathWithoutLocale !== '/') {
    const locale = pathname.startsWith('/en') ? 'en' : 'ro'
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')) {
    const locale = pathname.startsWith('/en') ? 'en' : 'ro'
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  // Apply i18n middleware
  const intlResponse = intlMiddleware(request)
  if (intlResponse) return intlResponse

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
