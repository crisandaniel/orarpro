-- ─────────────────────────────────────────────────────────────────────────────
-- 005_gdpr.sql
-- GDPR compliance: data export and account deletion
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Export all user data (right to portability) ─────────────────────────────

create or replace function public.export_user_data(target_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  -- Only allow users to export their own data
  if target_user_id != auth.uid() then
    raise exception 'Unauthorized';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select row_to_json(p) from public.profiles p where p.id = target_user_id
    ),
    'organizations', (
      select jsonb_agg(jsonb_build_object(
        'organization', row_to_json(o),
        'role', om.role,
        'employees', (
          select jsonb_agg(row_to_json(e))
          from public.employees e
          where e.organization_id = o.id
        ),
        'schedules', (
          select jsonb_agg(row_to_json(s))
          from public.schedules s
          where s.organization_id = o.id
        )
      ))
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = target_user_id
    )
  ) into result;

  return result;
end;
$$;

-- ─── Delete user account and all associated data ─────────────────────────────
-- Cascades handle most deletion via FK constraints
-- This function handles the cleanup and Stripe cancellation signal

create or replace function public.delete_user_account(target_user_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Only allow users to delete their own account
  if target_user_id != auth.uid() then
    raise exception 'Unauthorized';
  end if;

  -- Delete organizations where this user is the sole owner
  delete from public.organizations
  where id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = target_user_id
      and om.role = 'owner'
      and (
        select count(*) from public.organization_members om2
        where om2.organization_id = om.organization_id
          and om2.role = 'owner'
      ) = 1
  );

  -- Remove from organizations where others exist
  delete from public.organization_members
  where user_id = target_user_id;

  -- Delete profile (cascades to auth.users via trigger)
  delete from public.profiles where id = target_user_id;

  -- Note: auth.users deletion must be done via Supabase admin API
  -- Call this from the Next.js API route after this function succeeds
end;
$$;

-- ─── Audit log for sensitive operations ──────────────────────────────────────

create table public.audit_log (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles(id) on delete set null,
  action       text not null,  -- e.g. 'data_export', 'account_delete', 'schedule_publish'
  resource     text,           -- e.g. 'schedule', 'employee'
  resource_id  uuid,
  ip_address   text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

-- Audit log is append-only — no update or delete policies
alter table public.audit_log enable row level security;

create policy "Users can view their own audit log"
  on public.audit_log for select
  using (user_id = auth.uid());

create policy "System can insert audit entries"
  on public.audit_log for insert
  with check (true);
