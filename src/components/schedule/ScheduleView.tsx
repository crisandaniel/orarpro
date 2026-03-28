'use client'

// Client wrapper for schedule view — holds localAssignments state
// so ScheduleGrid and EmployeeStats stay in sync when assignments change manually.
// Used by: schedules/[id]/page.tsx.

import { useState } from 'react'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { EmployeeStats } from '@/components/schedule/EmployeeStats'
import type { Employee, ShiftDefinition, ShiftAssignment } from '@/types'

interface Props {
  schedule: any
  initialAssignments: any[]
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  holidays: any[]
  scheduleId: string
}

export function ScheduleView({
  schedule, initialAssignments, employees, shiftDefinitions, holidays, scheduleId
}: Props) {
  const [assignments, setAssignments] = useState(initialAssignments)

  return (
    <>
      <ScheduleGrid
        schedule={schedule}
        assignments={assignments as any}
        employees={employees}
        shiftDefinitions={shiftDefinitions}
        holidays={holidays}
        scheduleId={scheduleId}
        onAssignmentsChange={setAssignments}
      />
      <EmployeeStats
        employees={employees}
        assignments={assignments as any}
        shiftDefinitions={shiftDefinitions}
        schedule={schedule}
      />
    </>
  )
}