-- =============================================================================
-- 002_employees.sql
-- Employees, leaves, unavailability.
-- =============================================================================

create type public.experience_level as enum ('junior', 'mid', 'senior');

-- =============================================================================
-- EMPLOYEES
-- =============================================================================

create table public.employees (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            text,
  phone            text,
  experience_level experience_level not null default 'mid',
  color            text not null default '#6366f1',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger set_employees_updated_at
  before update on public.employees
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- EMPLOYEE LEAVES
-- Vacation, sick leave, personal days.
-- =============================================================================

create table public.employee_leaves (
  id           uuid primary key default uuid_generate_v4(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text,
  created_at   timestamptz not null default now(),
  constraint valid_leave_dates check (end_date >= start_date)
);

-- =============================================================================
-- EMPLOYEE UNAVAILABILITY
-- Recurring (never on Mondays) or one-off specific dates.
-- =============================================================================

create table public.employee_unavailability (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  day_of_week   smallint check (day_of_week between 0 and 6),  -- 0=Sun
  specific_date date,
  note          text,
  created_at    timestamptz not null default now(),
  constraint one_of_day_or_date check (
    (day_of_week is not null and specific_date is null) or
    (day_of_week is null and specific_date is not null)
  )
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_employees_org      on public.employees(organization_id);
create index idx_employees_active   on public.employees(organization_id, is_active);
create index idx_leaves_employee    on public.employee_leaves(employee_id);
create index idx_leaves_dates       on public.employee_leaves(start_date, end_date);
create index idx_unavail_employee   on public.employee_unavailability(employee_id);
