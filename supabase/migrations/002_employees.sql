-- ─────────────────────────────────────────────────────────────────────────────
-- 002_employees.sql
-- Employees, leaves, unavailability
-- ─────────────────────────────────────────────────────────────────────────────

create type public.experience_level as enum ('junior', 'mid', 'senior');

-- ─── Employees ───────────────────────────────────────────────────────────────

create table public.employees (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            text,
  phone            text,
  experience_level experience_level not null default 'mid',
  color            text default '#6366f1',  -- UI color for calendar display
  is_active        boolean not null default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create trigger set_employees_updated_at
  before update on public.employees
  for each row execute procedure public.set_updated_at();

-- ─── Employee Leaves ─────────────────────────────────────────────────────────
-- Vacation, sick leave, personal days

create table public.employee_leaves (
  id           uuid primary key default uuid_generate_v4(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text,
  created_at   timestamptz default now(),
  constraint valid_leave_dates check (end_date >= start_date)
);

-- ─── Employee Unavailability ──────────────────────────────────────────────────
-- Recurring (e.g. never on Mondays) or one-off specific dates

create table public.employee_unavailability (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  -- Recurring: day_of_week set, specific_date null
  -- One-off: specific_date set, day_of_week null
  day_of_week   smallint check (day_of_week between 0 and 6),  -- 0=Sun
  specific_date date,
  note          text,
  created_at    timestamptz default now(),
  constraint one_of_day_or_date check (
    (day_of_week is not null and specific_date is null) or
    (day_of_week is null and specific_date is not null)
  )
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_employees_org        on public.employees(organization_id);
create index idx_employees_active     on public.employees(organization_id, is_active);
create index idx_leaves_employee      on public.employee_leaves(employee_id);
create index idx_leaves_dates         on public.employee_leaves(start_date, end_date);
create index idx_unavail_employee     on public.employee_unavailability(employee_id);
