-- ─────────────────────────────────────────────────────────────────────────────
-- 004_rls.sql
-- Row Level Security — every user sees only their organization's data
-- This is also the GDPR data isolation layer
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
alter table public.profiles               enable row level security;
alter table public.organizations          enable row level security;
alter table public.organization_members   enable row level security;
alter table public.employees              enable row level security;
alter table public.employee_leaves        enable row level security;
alter table public.employee_unavailability enable row level security;
alter table public.shift_definitions      enable row level security;
alter table public.schedules              enable row level security;
alter table public.schedule_shifts        enable row level security;
alter table public.shift_assignments      enable row level security;
alter table public.constraints            enable row level security;
alter table public.subjects               enable row level security;
alter table public.teacher_subjects       enable row level security;

-- ─── Helper function ─────────────────────────────────────────────────────────
-- Returns org IDs where the current user is a member

create or replace function public.user_org_ids()
returns setof uuid language sql security definer stable as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
$$;

-- Returns true if user has a specific role (or higher) in an org
create or replace function public.user_has_role(org_id uuid, required_role member_role)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and (
        case required_role
          when 'viewer' then role in ('viewer','editor','admin','owner')
          when 'editor' then role in ('editor','admin','owner')
          when 'admin'  then role in ('admin','owner')
          when 'owner'  then role = 'owner'
        end
      )
  )
$$;

-- ─── Profiles ────────────────────────────────────────────────────────────────

create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ─── Organizations ────────────────────────────────────────────────────────────

create policy "Members can view their organizations"
  on public.organizations for select
  using (id in (select public.user_org_ids()));

create policy "Owners can update their organization"
  on public.organizations for update
  using (public.user_has_role(id, 'owner'));

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- ─── Organization Members ─────────────────────────────────────────────────────

create policy "Members can view org members"
  on public.organization_members for select
  using (organization_id in (select public.user_org_ids()));

create policy "Admins can manage members"
  on public.organization_members for all
  using (public.user_has_role(organization_id, 'admin'));

create policy "Users can insert themselves as owner on new org"
  on public.organization_members for insert
  with check (user_id = auth.uid() and role = 'owner');

-- ─── Employees ───────────────────────────────────────────────────────────────

create policy "Members can view employees"
  on public.employees for select
  using (organization_id in (select public.user_org_ids()));

create policy "Editors can manage employees"
  on public.employees for all
  using (public.user_has_role(organization_id, 'editor'));

-- ─── Employee Leaves ─────────────────────────────────────────────────────────

create policy "Members can view leaves"
  on public.employee_leaves for select
  using (
    employee_id in (
      select id from public.employees
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage leaves"
  on public.employee_leaves for all
  using (
    employee_id in (
      select e.id from public.employees e
      where public.user_has_role(e.organization_id, 'editor')
    )
  );

-- ─── Employee Unavailability ──────────────────────────────────────────────────

create policy "Members can view unavailability"
  on public.employee_unavailability for select
  using (
    employee_id in (
      select id from public.employees
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage unavailability"
  on public.employee_unavailability for all
  using (
    employee_id in (
      select e.id from public.employees e
      where public.user_has_role(e.organization_id, 'editor')
    )
  );

-- ─── Shift Definitions ───────────────────────────────────────────────────────

create policy "Members can view shift definitions"
  on public.shift_definitions for select
  using (organization_id in (select public.user_org_ids()));

create policy "Editors can manage shift definitions"
  on public.shift_definitions for all
  using (public.user_has_role(organization_id, 'editor'));

-- ─── Schedules ───────────────────────────────────────────────────────────────

create policy "Members can view schedules"
  on public.schedules for select
  using (organization_id in (select public.user_org_ids()));

create policy "Editors can manage schedules"
  on public.schedules for all
  using (public.user_has_role(organization_id, 'editor'));

-- ─── Schedule Shifts ─────────────────────────────────────────────────────────

create policy "Members can view schedule shifts"
  on public.schedule_shifts for select
  using (
    schedule_id in (
      select id from public.schedules
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage schedule shifts"
  on public.schedule_shifts for all
  using (
    schedule_id in (
      select s.id from public.schedules s
      where public.user_has_role(s.organization_id, 'editor')
    )
  );

-- ─── Shift Assignments ───────────────────────────────────────────────────────

create policy "Members can view assignments"
  on public.shift_assignments for select
  using (
    schedule_id in (
      select id from public.schedules
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage assignments"
  on public.shift_assignments for all
  using (
    schedule_id in (
      select s.id from public.schedules s
      where public.user_has_role(s.organization_id, 'editor')
    )
  );

-- ─── Constraints ─────────────────────────────────────────────────────────────

create policy "Members can view constraints"
  on public.constraints for select
  using (
    schedule_id in (
      select id from public.schedules
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage constraints"
  on public.constraints for all
  using (
    schedule_id in (
      select s.id from public.schedules s
      where public.user_has_role(s.organization_id, 'editor')
    )
  );

-- ─── Subjects ────────────────────────────────────────────────────────────────

create policy "Members can view subjects"
  on public.subjects for select
  using (organization_id in (select public.user_org_ids()));

create policy "Editors can manage subjects"
  on public.subjects for all
  using (public.user_has_role(organization_id, 'editor'));

create policy "Members can view teacher subjects"
  on public.teacher_subjects for select
  using (
    employee_id in (
      select id from public.employees
      where organization_id in (select public.user_org_ids())
    )
  );

create policy "Editors can manage teacher subjects"
  on public.teacher_subjects for all
  using (
    employee_id in (
      select e.id from public.employees e
      where public.user_has_role(e.organization_id, 'editor')
    )
  );
