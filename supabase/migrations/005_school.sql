-- =============================================================================
-- 005_school.sql
-- School/university timetable tables.
-- Supports: primary, middle school, high school, university (with groups).
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.institution_type   as enum ('primary', 'middle', 'highschool', 'university');
create type public.room_type          as enum ('classroom', 'lab', 'gym', 'amphitheater', 'seminar', 'workshop');
create type public.subject_difficulty as enum ('hard', 'medium', 'easy');
create type public.lesson_type        as enum ('regular', 'lecture', 'seminar', 'lab');

-- =============================================================================
-- SCHOOL RESOURCES (org-level, reused across schedules)
-- =============================================================================

create table public.school_teachers (
  id                   uuid primary key default uuid_generate_v4(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  name                 text not null,
  email                text,
  max_periods_per_day  smallint not null default 6,
  max_periods_per_week smallint not null default 20,
  color                text not null default '#6366f1',
  created_at           timestamptz not null default now()
);

create table public.school_subjects (
  id                 uuid primary key default uuid_generate_v4(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  name               text not null,
  short_name         text,
  color              text not null default '#6366f1',
  difficulty         subject_difficulty not null default 'medium',
  required_room_type room_type not null default 'classroom',
  created_at         timestamptz not null default now()
);

create table public.school_classes (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  year            smallint,
  student_count   smallint,
  has_groups      boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.school_groups (
  id            uuid primary key default uuid_generate_v4(),
  class_id      uuid not null references public.school_classes(id) on delete cascade,
  name          text not null,
  student_count smallint,
  created_at    timestamptz not null default now()
);

create table public.school_rooms (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  room_type       room_type not null default 'classroom',
  capacity        smallint,
  building        text,
  created_at      timestamptz not null default now()
);

create table public.school_teacher_unavailability (
  id         uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.school_teachers(id) on delete cascade,
  day        smallint not null,  -- 0=Mon … 4=Fri
  period     smallint,           -- null = entire day
  reason     text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SCHEDULE-LEVEL TABLES
-- =============================================================================

create table public.school_configs (
  id                    uuid primary key default uuid_generate_v4(),
  schedule_id           uuid not null references public.schedules(id) on delete cascade,
  institution_type      institution_type not null default 'highschool',
  periods_per_day       smallint not null default 7,
  period_duration_min   smallint not null default 50,
  break_duration_min    smallint not null default 10,
  first_period_start    time not null default '08:00',
  max_periods_per_day   smallint not null default 7,
  min_periods_per_day   smallint not null default 4,
  avoid_teacher_windows boolean not null default true,
  hard_subjects_morning boolean not null default true,
  created_at            timestamptz not null default now()
);

create table public.school_assignments (
  id                   uuid primary key default uuid_generate_v4(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  teacher_id           uuid not null references public.school_teachers(id) on delete cascade,
  subject_id           uuid not null references public.school_subjects(id) on delete cascade,
  class_id             uuid not null references public.school_classes(id) on delete cascade,
  group_id             uuid references public.school_groups(id) on delete cascade,
  lesson_type          lesson_type not null default 'regular',
  periods_per_week     smallint not null default 2,
  requires_consecutive boolean not null default false,
  preferred_room_id    uuid references public.school_rooms(id),
  created_at           timestamptz not null default now(),
  unique(schedule_id, teacher_id, subject_id, class_id, group_id)
);

create table public.school_lessons (
  id                  uuid primary key default uuid_generate_v4(),
  schedule_id         uuid not null references public.schedules(id) on delete cascade,
  assignment_id       uuid not null references public.school_assignments(id) on delete cascade,
  teacher_id          uuid not null references public.school_teachers(id),
  subject_id          uuid not null references public.school_subjects(id),
  class_id            uuid not null references public.school_classes(id),
  group_id            uuid references public.school_groups(id),
  room_id             uuid references public.school_rooms(id),
  day                 smallint not null,
  period              smallint not null,
  is_manual_override  boolean not null default false,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_school_teachers_org    on public.school_teachers(organization_id);
create index idx_school_subjects_org    on public.school_subjects(organization_id);
create index idx_school_classes_org     on public.school_classes(organization_id);
create index idx_school_rooms_org       on public.school_rooms(organization_id);
create index idx_school_groups_class    on public.school_groups(class_id);
create index idx_school_configs_sched   on public.school_configs(schedule_id);
create index idx_school_assign_sched    on public.school_assignments(schedule_id);
create index idx_school_lessons_sched   on public.school_lessons(schedule_id);
create index idx_school_lessons_teacher on public.school_lessons(teacher_id, day, period);
create index idx_school_lessons_class   on public.school_lessons(class_id, day, period);
create index idx_school_lessons_room    on public.school_lessons(room_id, day, period);

-- =============================================================================
-- RLS
-- NOTE: All policies include both USING and WITH CHECK.
-- USING  = controls SELECT / UPDATE / DELETE (row visibility)
-- WITH CHECK = controls INSERT / UPDATE (row validation)
-- Without WITH CHECK, INSERT is blocked even for authenticated members.
-- Resource tables (teachers/subjects/classes/rooms) are written directly
-- from the browser client (ResourcesClient.tsx), so both clauses are required.
-- =============================================================================

alter table public.school_teachers               enable row level security;
alter table public.school_subjects               enable row level security;
alter table public.school_classes                enable row level security;
alter table public.school_groups                 enable row level security;
alter table public.school_rooms                  enable row level security;
alter table public.school_teacher_unavailability enable row level security;
alter table public.school_configs                enable row level security;
alter table public.school_assignments            enable row level security;
alter table public.school_lessons                enable row level security;

-- ── Org-level resources ─────────────────────────────────────────────────────
-- Using separate SELECT and INSERT/UPDATE/DELETE policies to ensure
-- WITH CHECK is always enforced (FOR ALL + WITH CHECK can be unreliable).

-- school_teachers
create policy "school_teachers_select"
  on public.school_teachers for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "school_teachers_insert"
  on public.school_teachers for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "school_teachers_update"
  on public.school_teachers for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "school_teachers_delete"
  on public.school_teachers for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_subjects
create policy "school_subjects_select"
  on public.school_subjects for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "school_subjects_insert"
  on public.school_subjects for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "school_subjects_update"
  on public.school_subjects for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "school_subjects_delete"
  on public.school_subjects for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_classes
create policy "school_classes_select"
  on public.school_classes for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "school_classes_insert"
  on public.school_classes for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "school_classes_update"
  on public.school_classes for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "school_classes_delete"
  on public.school_classes for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_rooms
create policy "school_rooms_select"
  on public.school_rooms for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "school_rooms_insert"
  on public.school_rooms for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "school_rooms_update"
  on public.school_rooms for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "school_rooms_delete"
  on public.school_rooms for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_groups
create policy "school_groups_select"
  on public.school_groups for select to authenticated
  using (class_id in (
    select id from public.school_classes
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_groups_insert"
  on public.school_groups for insert to authenticated
  with check (class_id in (
    select id from public.school_classes
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_groups_update"
  on public.school_groups for update to authenticated
  using (class_id in (
    select id from public.school_classes
    where organization_id in (select public.user_org_ids())
  ))
  with check (class_id in (
    select id from public.school_classes
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_groups_delete"
  on public.school_groups for delete to authenticated
  using (class_id in (
    select id from public.school_classes
    where organization_id in (select public.user_org_ids())
  ));

-- school_teacher_unavailability
create policy "school_teacher_unavail_select"
  on public.school_teacher_unavailability for select to authenticated
  using (teacher_id in (
    select id from public.school_teachers
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_teacher_unavail_insert"
  on public.school_teacher_unavailability for insert to authenticated
  with check (teacher_id in (
    select id from public.school_teachers
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_teacher_unavail_update"
  on public.school_teacher_unavailability for update to authenticated
  using (teacher_id in (
    select id from public.school_teachers
    where organization_id in (select public.user_org_ids())
  ))
  with check (teacher_id in (
    select id from public.school_teachers
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_teacher_unavail_delete"
  on public.school_teacher_unavailability for delete to authenticated
  using (teacher_id in (
    select id from public.school_teachers
    where organization_id in (select public.user_org_ids())
  ));

-- ── Schedule-level resources ──────────────────────────────────────────────────

-- school_configs
create policy "school_configs_select"
  on public.school_configs for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_configs_insert"
  on public.school_configs for insert to authenticated
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_configs_update"
  on public.school_configs for update to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ))
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_configs_delete"
  on public.school_configs for delete to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));

-- school_assignments
create policy "school_assignments_select"
  on public.school_assignments for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_assignments_insert"
  on public.school_assignments for insert to authenticated
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_assignments_update"
  on public.school_assignments for update to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ))
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_assignments_delete"
  on public.school_assignments for delete to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));

-- school_lessons
create policy "school_lessons_select"
  on public.school_lessons for select to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_lessons_insert"
  on public.school_lessons for insert to authenticated
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_lessons_update"
  on public.school_lessons for update to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ))
  with check (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
create policy "school_lessons_delete"
  on public.school_lessons for delete to authenticated
  using (schedule_id in (
    select id from public.schedules
    where organization_id in (select public.user_org_ids())
  ));
