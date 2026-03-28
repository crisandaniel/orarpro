-- =============================================================================
-- 004_rls.sql
-- Row Level Security — every user sees only their organization's data.
-- Uses separate SELECT / INSERT / UPDATE / DELETE policies for each table.
-- This avoids the FOR ALL + WITH CHECK null issue in PostgreSQL/Supabase.
-- =============================================================================

-- Enable RLS on all tables
alter table public.profiles                   enable row level security;
alter table public.organizations              enable row level security;
alter table public.organization_members       enable row level security;
alter table public.employees                  enable row level security;
alter table public.employee_leaves            enable row level security;
alter table public.employee_unavailability    enable row level security;
alter table public.shift_definitions          enable row level security;
alter table public.schedules                  enable row level security;
alter table public.schedule_shifts            enable row level security;
alter table public.shift_assignments          enable row level security;
alter table public.constraints                enable row level security;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

create or replace function public.user_org_ids()
returns setof uuid language sql security definer stable as $$
  select organization_id from public.organization_members
  where user_id = auth.uid()
$$;

create or replace function public.user_has_role(org_id uuid, required_role member_role)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
      and (case required_role
        when 'viewer' then role in ('viewer','editor','admin','owner')
        when 'editor' then role in ('editor','admin','owner')
        when 'admin'  then role in ('admin','owner')
        when 'owner'  then role = 'owner'
      end)
  )
$$;

-- =============================================================================
-- PROFILES
-- =============================================================================

create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

create policy "organizations_select" on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));
create policy "organizations_insert" on public.organizations
  for insert to authenticated
  with check (auth.uid() is not null);
create policy "organizations_update" on public.organizations
  for update to authenticated
  using (public.user_has_role(id, 'owner'))
  with check (public.user_has_role(id, 'owner'));
create policy "organizations_delete" on public.organizations
  for delete to authenticated
  using (public.user_has_role(id, 'owner'));

-- =============================================================================
-- ORGANIZATION MEMBERS
-- =============================================================================

create policy "org_members_select" on public.organization_members
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "org_members_insert" on public.organization_members
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'owner');
create policy "org_members_update" on public.organization_members
  for update to authenticated
  using (public.user_has_role(organization_id, 'admin'))
  with check (public.user_has_role(organization_id, 'admin'));
create policy "org_members_delete" on public.organization_members
  for delete to authenticated
  using (public.user_has_role(organization_id, 'admin'));

-- =============================================================================
-- EMPLOYEES
-- =============================================================================

create policy "employees_select" on public.employees
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "employees_insert" on public.employees
  for insert to authenticated
  with check (public.user_has_role(organization_id, 'editor'));
create policy "employees_update" on public.employees
  for update to authenticated
  using (public.user_has_role(organization_id, 'editor'))
  with check (public.user_has_role(organization_id, 'editor'));
create policy "employees_delete" on public.employees
  for delete to authenticated
  using (public.user_has_role(organization_id, 'editor'));

-- =============================================================================
-- EMPLOYEE LEAVES
-- =============================================================================

create policy "employee_leaves_select" on public.employee_leaves
  for select to authenticated
  using (employee_id in (
    select id from public.employees
    where organization_id in (select public.user_org_ids())
  ));
create policy "employee_leaves_insert" on public.employee_leaves
  for insert to authenticated
  with check (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));
create policy "employee_leaves_update" on public.employee_leaves
  for update to authenticated
  using (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ))
  with check (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));
create policy "employee_leaves_delete" on public.employee_leaves
  for delete to authenticated
  using (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));

-- =============================================================================
-- EMPLOYEE UNAVAILABILITY
-- =============================================================================

create policy "employee_unavail_select" on public.employee_unavailability
  for select to authenticated
  using (employee_id in (
    select id from public.employees
    where organization_id in (select public.user_org_ids())
  ));
create policy "employee_unavail_insert" on public.employee_unavailability
  for insert to authenticated
  with check (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));
create policy "employee_unavail_update" on public.employee_unavailability
  for update to authenticated
  using (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ))
  with check (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));
create policy "employee_unavail_delete" on public.employee_unavailability
  for delete to authenticated
  using (employee_id in (
    select e.id from public.employees e
    where public.user_has_role(e.organization_id, 'editor')
  ));

-- =============================================================================
-- SHIFT DEFINITIONS
-- =============================================================================

create policy "shift_defs_select" on public.shift_definitions
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "shift_defs_insert" on public.shift_definitions
  for insert to authenticated
  with check (public.user_has_role(organization_id, 'editor'));
create policy "shift_defs_update" on public.shift_definitions
  for update to authenticated
  using (public.user_has_role(organization_id, 'editor'))
  with check (public.user_has_role(organization_id, 'editor'));
create policy "shift_defs_delete" on public.shift_definitions
  for delete to authenticated
  using (public.user_has_role(organization_id, 'editor'));

-- =============================================================================
-- SCHEDULES
-- =============================================================================

create policy "schedules_select" on public.schedules
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "schedules_insert" on public.schedules
  for insert to authenticated
  with check (public.user_has_role(organization_id, 'editor'));
create policy "schedules_update" on public.schedules
  for update to authenticated
  using (public.user_has_role(organization_id, 'editor'))
  with check (public.user_has_role(organization_id, 'editor'));
create policy "schedules_delete" on public.schedules
  for delete to authenticated
  using (public.user_has_role(organization_id, 'editor'));

-- =============================================================================
-- SCHEDULE SHIFTS
-- =============================================================================

create policy "schedule_shifts_select" on public.schedule_shifts
  for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "schedule_shifts_insert" on public.schedule_shifts
  for insert to authenticated
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "schedule_shifts_update" on public.schedule_shifts
  for update to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ))
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "schedule_shifts_delete" on public.schedule_shifts
  for delete to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));

-- =============================================================================
-- SHIFT ASSIGNMENTS
-- =============================================================================

create policy "shift_assignments_select" on public.shift_assignments
  for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "shift_assignments_insert" on public.shift_assignments
  for insert to authenticated
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "shift_assignments_update" on public.shift_assignments
  for update to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ))
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "shift_assignments_delete" on public.shift_assignments
  for delete to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));

-- =============================================================================
-- CONSTRAINTS
-- =============================================================================

create policy "constraints_select" on public.constraints
  for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "constraints_insert" on public.constraints
  for insert to authenticated
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "constraints_update" on public.constraints
  for update to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ))
  with check (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
create policy "constraints_delete" on public.constraints
  for delete to authenticated
  using (schedule_id in (
    select s.id from public.schedules s
    where public.user_has_role(s.organization_id, 'editor')
  ));
