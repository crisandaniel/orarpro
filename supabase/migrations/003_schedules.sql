-- ─────────────────────────────────────────────────────────────────────────────
-- 003_schedules.sql
-- Shift definitions, schedules, assignments, constraints
-- ─────────────────────────────────────────────────────────────────────────────

create type public.shift_type       as enum ('morning', 'afternoon', 'night', 'custom');
create type public.generation_status as enum ('draft', 'generating', 'generated', 'published');
create type public.constraint_type  as enum (
  'pair_required',      -- A must work with B
  'pair_forbidden',     -- A cannot work with B
  'rest_after_shift',   -- After shift X, rest Y hours minimum
  'max_consecutive',    -- Max N consecutive working days
  'max_weekly_hours',   -- Max N hours per week
  'max_night_shifts',   -- Max N night shifts per week
  'min_seniority',      -- Shift must have at least 1 senior
  'min_staff',          -- Shift must have at least N employees
  'fixed_shift'         -- Employee always gets same shift type
);

-- ─── Shift Definitions ───────────────────────────────────────────────────────
-- Templates reused across schedules within an organization

create table public.shift_definitions (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,           -- e.g. "Morning", "Noapte"
  shift_type       shift_type not null default 'custom',
  start_time       time not null,           -- e.g. 06:00
  end_time         time not null,           -- e.g. 14:00
  crosses_midnight boolean not null default false,
  color            text not null default '#6366f1',
  created_at       timestamptz default now()
);

-- ─── Schedules ───────────────────────────────────────────────────────────────

create table public.schedules (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  type              schedule_type not null default 'shifts',
  start_date        date not null,
  end_date          date not null,
  -- Working days: array of ISO weekday numbers 1=Mon … 7=Sun
  working_days      smallint[] not null default array[1,2,3,4,5],
  include_holidays  boolean not null default true,
  country_code      text not null default 'RO',
  status            generation_status not null default 'draft',
  -- Generation configuration stored as JSONB for flexibility
  generation_config jsonb not null default '{
    "min_employees_per_shift": 1,
    "max_consecutive_days": 6,
    "min_rest_hours_between_shifts": 11,
    "max_weekly_hours": 48,
    "max_night_shifts_per_week": 2,
    "enforce_legal_limits": true,
    "balance_shift_distribution": true,
    "min_window_periods": 1
  }'::jsonb,
  -- AI analysis cache
  ai_suggestions    jsonb,
  ai_analyzed_at    timestamptz,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  constraint valid_schedule_dates check (end_date > start_date)
);

create trigger set_schedules_updated_at
  before update on public.schedules
  for each row execute procedure public.set_updated_at();

-- ─── Schedule Shift Definitions ──────────────────────────────────────────────
-- Which shift definitions are active for a specific schedule

create table public.schedule_shifts (
  id                   uuid primary key default uuid_generate_v4(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  shift_definition_id  uuid not null references public.shift_definitions(id) on delete cascade,
  slots_per_day        int not null default 1,  -- how many of this shift per day
  unique(schedule_id, shift_definition_id)
);

-- ─── Shift Assignments ───────────────────────────────────────────────────────
-- The actual generated or manually set schedule entries

create table public.shift_assignments (
  id                   uuid primary key default uuid_generate_v4(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  employee_id          uuid not null references public.employees(id) on delete cascade,
  shift_definition_id  uuid not null references public.shift_definitions(id),
  date                 date not null,
  role_in_shift        text,          -- e.g. "floor manager", "cashier", "debarasat"
  is_manual_override   boolean not null default false,
  note                 text,
  created_at           timestamptz default now(),
  unique(schedule_id, employee_id, date, shift_definition_id)
);

-- ─── Constraints ─────────────────────────────────────────────────────────────

create table public.constraints (
  id                   uuid primary key default uuid_generate_v4(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  type                 constraint_type not null,
  -- Target employee (null = applies to all employees)
  employee_id          uuid references public.employees(id) on delete cascade,
  -- For pair constraints: the second employee
  target_employee_id   uuid references public.employees(id) on delete cascade,
  -- For shift-specific constraints
  shift_definition_id  uuid references public.shift_definitions(id) on delete cascade,
  -- Numeric value: hours for rest_after_shift, count for max_*, etc.
  value                numeric,
  note                 text,
  is_active            boolean not null default true,
  created_at           timestamptz default now()
);

-- ─── School-specific: Subject Definitions ────────────────────────────────────
-- Only used when schedule.type = 'school'

create table public.subjects (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#6366f1',
  created_at       timestamptz default now()
);

-- Teacher-subject assignments with hours per week
create table public.teacher_subjects (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  hours_per_week smallint not null default 2,
  unique(employee_id, subject_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_schedules_org          on public.schedules(organization_id);
create index idx_schedules_status       on public.schedules(status);
create index idx_assignments_schedule   on public.shift_assignments(schedule_id);
create index idx_assignments_employee   on public.shift_assignments(employee_id);
create index idx_assignments_date       on public.shift_assignments(date);
create index idx_assignments_lookup     on public.shift_assignments(schedule_id, date);
create index idx_constraints_schedule   on public.constraints(schedule_id);
create index idx_constraints_employee   on public.constraints(employee_id);
create index idx_shift_defs_org         on public.shift_definitions(organization_id);
