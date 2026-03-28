// src/lib/dal/school.ts
// Data Access Layer for school resources: teachers, subjects, classes, rooms.

import { createAdminClient } from '@/lib/supabase/server'
import type { SchoolResources, SchoolTeacher, SchoolSubject, SchoolClass, SchoolRoom } from '@/types'

export async function getSchoolResources(orgId: string): Promise<SchoolResources> {
  const admin = createAdminClient()

  const [teachersRes, subjectsRes, classesRes, roomsRes] = await Promise.all([
    admin.from('school_teachers').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_subjects').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_classes').select('*').eq('organization_id', orgId).order('name'),
    admin.from('school_rooms').select('*').eq('organization_id', orgId).order('name'),
  ])

  return {
    teachers: (teachersRes.data ?? []) as SchoolTeacher[],
    subjects: (subjectsRes.data ?? []) as SchoolSubject[],
    classes: (classesRes.data ?? []) as SchoolClass[],
    rooms: (roomsRes.data ?? []) as SchoolRoom[],
  }
}

export async function getSchoolScheduleData(scheduleId: string) {
  const admin = createAdminClient()

  const [configRes, assignmentsRes, lessonsRes] = await Promise.all([
    admin.from('school_configs').select('*').eq('schedule_id', scheduleId).single(),
    admin.from('school_assignments').select('*').eq('schedule_id', scheduleId),
    admin.from('school_lessons').select(`
      *,
      school_teachers(name, color),
      school_subjects(name, short_name, color),
      school_classes(name),
      school_groups(name),
      school_rooms(name)
    `).eq('schedule_id', scheduleId),
  ])

  return {
    config: configRes.data,
    assignments: assignmentsRes.data ?? [],
    lessons: lessonsRes.data ?? [],
  }
}
