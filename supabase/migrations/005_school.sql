-- =============================================================================
-- 005_school.sql  (v3)
-- School timetable tables based on the agreed TypeScript model.
--
-- Architecture:
--   Org-level resources (reutilizate între orare):
--     school_teachers, school_subjects, school_classes, school_rooms
--
--   Schedule-level (per orar):
--     schedule_configs  — TimeConfig + SoftRules + metadata
--     curriculum_items  — CurriculumItem: clasă × materie × profesor × ore
--     school_lessons    — output solver: lecții plasate în grilă
--
-- Key decisions:
--   - unavailable_slots / preferred_slots stocate ca jsonb array de strings "d-p"
--   - lesson_pattern stocată ca jsonb array de ints, ex: [2,1,1]
--   - soft_rules stocată ca jsonb (flexibil la adăugare constraints noi)
--   - school_lessons nu are FK la curriculum_items — solver poate genera
--     lecții fără assignment explicit (mai flexibil)
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.room_type as enum (
  'homeroom',
  'gym',
  'computer_lab',
  'chemistry_lab',
  'generic'
);

create type public.subject_difficulty as enum ('hard', 'medium', 'easy');

create type public.class_stage as enum (
  'primary',    -- clasele 0-4
  'middle',     -- clasele 5-8
  'high',       -- clasele 9-12
  'university'
);

-- =============================================================================
-- ORG-LEVEL RESOURCES
-- Definite o singură dată per instituție, reutilizate în orice orar.
-- =============================================================================

-- Profesori
create table public.school_teachers (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  color               text not null default '#6366f1',

  -- Disponibilitate: sloturi în care NU poate preda (format "day-period", ex: "0-3")
  -- Toate sloturile nelistate = disponibil
  unavailable_slots   jsonb not null default '[]'::jsonb,  -- string[]

  -- Sloturi preferate (soft constraint)
  preferred_slots     jsonb not null default '[]'::jsonb,  -- string[]

  -- Limite ore (hard când setate)
  max_lessons_per_day  smallint,          -- null = fără limită explicită
  max_lessons_per_week smallint,          -- null = fără limită explicită
  min_lessons_per_week smallint,          -- normă minimă — hard când setat

  created_at          timestamptz not null default now()
);

-- Materii
create table public.school_subjects (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  short_name          text,
  color               text not null default '#6366f1',

  -- Tipul de sală necesar (null = orice sală)
  required_room_type  room_type,

  -- Dificultate → influențează soft constraint "materii grele dimineața"
  difficulty          subject_difficulty not null default 'medium',

  created_at          timestamptz not null default now()
);

-- Săli
create table public.school_rooms (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  type            room_type not null default 'generic',
  capacity        smallint,
  created_at      timestamptz not null default now()
);

-- Clase
-- homeroom_id adăugat după school_rooms
create table public.school_classes (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,         -- ex: "9A", "Grupa CTI-1"
  grade_number        smallint not null default 0,
  stage               class_stage not null default 'high',
  max_lessons_per_day smallint not null default 6,
  homeroom_id         uuid references public.school_rooms(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- SCHEDULE-LEVEL TABLES
-- =============================================================================

-- Configurare per orar:
-- - moștenește TimeConfig din org dar editabil per orar
-- - stochează SoftRules cu weights
create table public.schedule_configs (
  id              uuid primary key default uuid_generate_v4(),
  schedule_id     uuid not null references public.schedules(id) on delete cascade,

  -- TimeConfig (editabil per orar, default din org)
  days_per_week    smallint not null default 5,    -- 5 = Lun-Vin
  slots_per_day    smallint not null default 8,    -- nr. maxim sloturi/zi instituție
  slot_duration    smallint not null default 50,   -- minute per slot
  first_slot_start time    not null default '08:00', -- ora primului slot

  -- SoftRules stocate ca jsonb pentru flexibilitate la adăugare constraints noi
  -- Structură: { avoidGapsForTeachers, avoidLastHourForStages, ...weights }
  soft_rules      jsonb not null default '{
    "avoidGapsForTeachers": true,
    "avoidLastHourForStages": ["primary", "middle"],
    "avoidSameSubjectTwicePerDay": true,
    "hardSubjectsMorning": true,
    "startFromFirstSlot": true,
    "weights": {
      "teacherGaps": 80,
      "lastHour": 60,
      "sameSubject": 70,
      "hardMorning": 50,
      "startFirst": 90
    }
  }'::jsonb,

  -- Solver metadata
  solver_used     text,
  generated_at    timestamptz,

  created_at      timestamptz not null default now()
);

-- Curriculum items: inima orarului
-- Definește ce predă fiecare profesor la fiecare clasă și câte ore
create table public.curriculum_items (
  id              uuid primary key default uuid_generate_v4(),
  schedule_id     uuid not null references public.schedules(id) on delete cascade,
  class_id        uuid not null references public.school_classes(id) on delete cascade,
  subject_id      uuid not null references public.school_subjects(id) on delete cascade,
  teacher_id      uuid not null references public.school_teachers(id) on delete restrict,

  -- Ore pe săptămână
  weekly_hours    smallint not null check (weekly_hours > 0),

  -- Pattern lecții: sum(lesson_pattern) = weekly_hours
  -- [1,1,1] = 3 ore single | [2,1] = 1 bloc dublu + 1 oră single
  -- null = implicit [1,1,...,1]
  lesson_pattern  jsonb,  -- smallint[]

  -- Sală preferată (soft — solver încearcă să o folosească)
  preferred_room_id uuid references public.school_rooms(id) on delete set null,

  created_at      timestamptz not null default now(),

  -- Un profesor predă o materie la o clasă o singură dată per orar
  unique(schedule_id, class_id, subject_id, teacher_id)
);

-- Output solver: lecțiile generate, plasate în grilă
create table public.school_lessons (
  id          uuid primary key default uuid_generate_v4(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  class_id    uuid not null references public.school_classes(id) on delete cascade,
  subject_id  uuid not null references public.school_subjects(id) on delete cascade,
  teacher_id  uuid not null references public.school_teachers(id) on delete restrict,
  room_id     uuid references public.school_rooms(id) on delete set null,

  -- Slot: day 0-based (0=Lun), period 0-based
  day         smallint not null,
  period      smallint not null,
  duration    smallint not null default 1,  -- 1 sau 2 (bloc dublu)

  -- Permite editare manuală post-generare
  is_manual   boolean not null default false,

  created_at  timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_school_teachers_org    on public.school_teachers(organization_id);
create index idx_school_subjects_org    on public.school_subjects(organization_id);
create index idx_school_classes_org     on public.school_classes(organization_id);
create index idx_school_rooms_org       on public.school_rooms(organization_id);

create index idx_schedule_configs_sched on public.schedule_configs(schedule_id);
create index idx_curriculum_sched       on public.curriculum_items(schedule_id);
create index idx_curriculum_class       on public.curriculum_items(class_id);
create index idx_curriculum_teacher     on public.curriculum_items(teacher_id);
create index idx_lessons_sched          on public.school_lessons(schedule_id);
create index idx_lessons_class_slot     on public.school_lessons(class_id, day, period);
create index idx_lessons_teacher_slot   on public.school_lessons(teacher_id, day, period);
create index idx_lessons_room_slot      on public.school_lessons(room_id, day, period);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.school_teachers    enable row level security;
alter table public.school_subjects    enable row level security;
alter table public.school_classes     enable row level security;
alter table public.school_rooms       enable row level security;
alter table public.schedule_configs   enable row level security;
alter table public.curriculum_items   enable row level security;
alter table public.school_lessons     enable row level security;

-- Helper: schedule belongs to org
create or replace function public.schedule_org_id(sid uuid)
returns uuid language sql security definer stable as $$
  select organization_id from public.schedules where id = sid
$$;

-- ── Org-level resources ───────────────────────────────────────────────────────

-- Macro pentru policies repetitive pe tabele cu organization_id direct
-- school_teachers
create policy "teachers_select" on public.school_teachers for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "teachers_insert" on public.school_teachers for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "teachers_update" on public.school_teachers for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "teachers_delete" on public.school_teachers for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_subjects
create policy "subjects_select" on public.school_subjects for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "subjects_insert" on public.school_subjects for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "subjects_update" on public.school_subjects for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "subjects_delete" on public.school_subjects for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_classes
create policy "classes_select" on public.school_classes for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "classes_insert" on public.school_classes for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "classes_update" on public.school_classes for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "classes_delete" on public.school_classes for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- school_rooms
create policy "rooms_select" on public.school_rooms for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "rooms_insert" on public.school_rooms for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "rooms_update" on public.school_rooms for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "rooms_delete" on public.school_rooms for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- ── Schedule-level ────────────────────────────────────────────────────────────

-- schedule_configs
create policy "sched_configs_select" on public.schedule_configs for select to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "sched_configs_insert" on public.schedule_configs for insert to authenticated
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "sched_configs_update" on public.schedule_configs for update to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()))
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "sched_configs_delete" on public.schedule_configs for delete to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));

-- curriculum_items
create policy "curriculum_select" on public.curriculum_items for select to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "curriculum_insert" on public.curriculum_items for insert to authenticated
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "curriculum_update" on public.curriculum_items for update to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()))
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "curriculum_delete" on public.curriculum_items for delete to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));

-- school_lessons
create policy "lessons_select" on public.school_lessons for select to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "lessons_insert" on public.school_lessons for insert to authenticated
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "lessons_update" on public.school_lessons for update to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()))
  with check (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
create policy "lessons_delete" on public.school_lessons for delete to authenticated
  using (public.schedule_org_id(schedule_id) in (select public.user_org_ids()));
