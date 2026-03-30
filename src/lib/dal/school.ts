// src/lib/dal/school.ts
// Data Access Layer for school resources and schedule data.
// Used by server components and API routes.

import { createAdminClient } from '@/lib/supabase/server'
import type { SchoolResources } from '@/types'

// ── Org-level resources ───────────────────────────────────────────────────────

export async function getSchoolResources(orgId: string): Promise<SchoolResources> {
  const admin = createAdminClient()

  const [teachersRes, subjectsRes, classesRes, roomsRes] = await Promise.all([
    admin.from('school_teachers').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_subjects').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_classes').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_rooms').select('*').eq('organization_id', orgId).order('name'),
  ])

  return {
    teachers: (teachersRes.data ?? []).map(t => ({
      ...t,
      unavailable_slots: t.unavailable_slots ?? [],
      preferred_slots:   t.preferred_slots   ?? [],
    })),
    subjects: subjectsRes.data ?? [],
    classes:  classesRes.data  ?? [],
    rooms:    roomsRes.data    ?? [],
  }
}

// ── Schedule-level data ───────────────────────────────────────────────────────

export async function getScheduleConfig(scheduleId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('schedule_configs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .single()
  return data
}

export async function getCurriculumItems(scheduleId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('curriculum_items')
    .select(`
      *,
      school_classes   ( name, grade_number, stage ),
      school_subjects  ( name, short_name, color, difficulty, required_room_type ),
      school_teachers  ( name, color ),
      school_rooms     ( name, type )
    `)
    .eq('schedule_id', scheduleId)
    .order('created_at')
  return data ?? []
}

export async function getLessons(scheduleId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('school_lessons')
    .select(`
      *,
      school_classes  ( name ),
      school_subjects ( name, short_name, color ),
      school_teachers ( name, color ),
      school_rooms    ( name )
    `)
    .eq('schedule_id', scheduleId)
    .order('day').order('period')
  return data ?? []
}
