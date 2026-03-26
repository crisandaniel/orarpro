-- ─────────────────────────────────────────────────────────────────────────────
-- 001_core.sql
-- Core tables: profiles, organizations, members
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with public profile data

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  -- GDPR consent tracking
  gdpr_consent_at       timestamptz,
  terms_accepted_at     timestamptz,
  marketing_consent     boolean default false,
  -- Metadata
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Organizations ────────────────────────────────────────────────────────────

create type public.plan_type as enum ('free', 'starter', 'pro', 'business');
create type public.schedule_type as enum ('shifts', 'school');

create table public.organizations (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  country_code            text not null default 'RO',  -- ISO 3166-1 alpha-2
  plan                    plan_type not null default 'free',
  -- Stripe
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  trial_ends_at           timestamptz default (now() + interval '14 days'),
  subscription_ends_at    timestamptz,
  -- Limits (denormalized for fast checks)
  max_employees           int not null default 10,
  -- Metadata
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── Organization Members ─────────────────────────────────────────────────────

create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');

create table public.organization_members (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             member_role not null default 'editor',
  invited_by       uuid references public.profiles(id),
  accepted_at      timestamptz,
  created_at       timestamptz default now(),
  unique(organization_id, user_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_org_members_user    on public.organization_members(user_id);
create index idx_org_members_org     on public.organization_members(organization_id);
create index idx_organizations_plan  on public.organizations(plan);

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.set_updated_at();
