-- =============================================================================
-- 000_drop_all.sql
-- Drops everything in reverse dependency order.
-- Run before re-running migrations for a clean slate.
-- WARNING: DESTRUCTIVE — all data will be lost.
-- =============================================================================

-- ── Triggers ──────────────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created             on auth.users;
drop trigger if exists on_org_member_insert             on public.organization_members;
drop trigger if exists set_profiles_updated_at          on public.profiles;
drop trigger if exists set_organizations_updated_at     on public.organizations;
drop trigger if exists set_employees_updated_at         on public.employees;
drop trigger if exists set_schedules_updated_at         on public.schedules;

-- ── Functions ─────────────────────────────────────────────────────────────────
drop function if exists public.handle_new_user()                  cascade;
drop function if exists public.set_updated_at()                   cascade;
drop function if exists public.set_active_org_on_member_insert()  cascade;
drop function if exists public.user_org_ids()                     cascade;
drop function if exists public.user_has_role(uuid, member_role)   cascade;
drop function if exists public.export_user_data(uuid)             cascade;
drop function if exists public.delete_user_account(uuid)          cascade;

-- ── School (schedule-level) ───────────────────────────────────────────────────
drop table if exists public.school_lessons          cascade;
drop table if exists public.curriculum_items        cascade;
drop table if exists public.schedule_configs        cascade;

-- ── School (org-level resources) ──────────────────────────────────────────────
drop table if exists public.school_rooms            cascade;
drop table if exists public.school_classes          cascade;
drop table if exists public.school_subjects         cascade;
drop table if exists public.school_teachers         cascade;

-- ── Business schedule ─────────────────────────────────────────────────────────
drop table if exists public.constraints             cascade;
drop table if exists public.shift_assignments       cascade;
drop table if exists public.schedule_shifts         cascade;
drop table if exists public.schedules               cascade;
drop table if exists public.shift_definitions       cascade;

-- ── Employees ─────────────────────────────────────────────────────────────────
drop table if exists public.employee_unavailability cascade;
drop table if exists public.employee_leaves         cascade;
drop table if exists public.employees               cascade;

-- ── GDPR / contact ────────────────────────────────────────────────────────────
drop table if exists public.audit_log               cascade;
drop table if exists public.contact_requests        cascade;

-- ── Core ──────────────────────────────────────────────────────────────────────
drop table if exists public.organization_members    cascade;
drop table if exists public.profiles                cascade;
drop table if exists public.organizations           cascade;

-- ── Enums ─────────────────────────────────────────────────────────────────────
drop type if exists public.room_type          cascade;
drop type if exists public.subject_difficulty cascade;
drop type if exists public.class_stage        cascade;
drop type if exists public.constraint_type    cascade;
drop type if exists public.generation_status  cascade;
drop type if exists public.shift_type         cascade;
drop type if exists public.schedule_type      cascade;
drop type if exists public.experience_level   cascade;
drop type if exists public.member_role        cascade;
drop type if exists public.org_type           cascade;
drop type if exists public.plan_type          cascade;

-- Legacy enums (may exist from older migrations)
drop type if exists public.lesson_type        cascade;
drop type if exists public.institution_type   cascade;
