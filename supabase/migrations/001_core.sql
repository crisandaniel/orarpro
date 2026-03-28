-- =============================================================================
-- 001_core.sql
-- Core tables: profiles, organizations, members.
-- Includes: org_type, active_organization_id, auto-set trigger.
-- =============================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.plan_type    as enum ('free', 'starter', 'pro', 'business');
create type public.org_type     as enum ('business', 'education');
create type public.member_role  as enum ('owner', 'admin', 'editor', 'viewer');
create type public.schedule_type as enum ('shifts', 'school');

-- =============================================================================
-- PROFILES
-- Extends auth.users with public data. Created via trigger on signup.
-- =============================================================================

create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  full_name               text,
  avatar_url              text,
  active_organization_id  uuid,  -- FK added after organizations table
  -- GDPR consent
  gdpr_consent_at         timestamptz,
  terms_accepted_at       timestamptz,
  marketing_consent       boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

create table public.organizations (
  id                     uuid primary key default uuid_generate_v4(),
  name                   text not null,
  country_code           text not null default 'RO',
  plan                   plan_type not null default 'free',
  org_type               org_type not null default 'business',
  -- Stripe
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  trial_ends_at          timestamptz default (now() + interval '14 days'),
  subscription_ends_at   timestamptz,
  -- Limits
  max_employees          int not null default 10,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Now add FK from profiles to organizations
alter table public.profiles
  add constraint profiles_active_org_fk
  foreign key (active_organization_id)
  references public.organizations(id)
  on delete set null;

-- =============================================================================
-- ORGANIZATION MEMBERS
-- =============================================================================

create table public.organization_members (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             member_role not null default 'editor',
  invited_by       uuid references public.profiles(id),
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_org_members_user        on public.organization_members(user_id);
create index idx_org_members_org         on public.organization_members(organization_id);
create index idx_organizations_plan      on public.organizations(plan);
create index idx_organizations_org_type  on public.organizations(org_type);
create index idx_profiles_active_org     on public.profiles(active_organization_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at helper
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

-- Auto-set active_organization_id on first membership
create or replace function public.set_active_org_on_member_insert()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
  set active_organization_id = new.organization_id
  where id = new.user_id
    and active_organization_id is null;
  return new;
end;
$$;

create trigger on_org_member_insert
  after insert on public.organization_members
  for each row execute procedure public.set_active_org_on_member_insert();
