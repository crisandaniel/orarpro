// GET /api/auth/logout — signs out server-side and clears session cookies.
// Using an API route ensures cookies are properly cleared on the server,
// which fixes logout issues on Vercel where client-side signOut() alone
// doesn't always invalidate the SSR session.
// Used by: SidebarNav logout button.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  const url = new URL(request.url)
  const locale = url.searchParams.get('locale') || 'ro'
  const redirectUrl = new URL(`/${locale}/login`, request.url)

  return NextResponse.redirect(redirectUrl)
}
