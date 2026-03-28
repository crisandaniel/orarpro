// POST /api/contact — saves contact / early access requests to Supabase.
// Table: contact_requests (id, name, email, message, user_id, created_at)
// Used by: Contact page form.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { name, email, message } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from('contact_requests').insert({
    name,
    email,
    message,
    user_id: user?.id ?? null,
  })

  if (error) console.error('Contact insert error:', error.message)

  return NextResponse.json({ success: true })
}
