-- ─────────────────────────────────────────────────────────────────────────────
-- 006_contact.sql
-- Contact / early access waitlist table
-- Stores messages from users who want more features or paid plans.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.contact_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text not null,
  message     text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

-- Allow multiple messages from the same email (unlike waitlist upsert)
create index contact_requests_email_idx on public.contact_requests(email);
create index contact_requests_created_at_idx on public.contact_requests(created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.contact_requests enable row level security;

-- Users can insert their own requests
create policy "Users can submit contact requests"
  on public.contact_requests for insert
  to authenticated
  with check (true);

-- Users can view their own requests
create policy "Users can view own contact requests"
  on public.contact_requests for select
  to authenticated
  using (user_id = auth.uid() or email = (
    select email from public.profiles where id = auth.uid()
  ));

-- Service role (admin) can see all — for reviewing in Supabase dashboard
-- (no policy needed — service role bypasses RLS)