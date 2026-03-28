// src/lib/dal/employees.ts
// Data Access Layer for employees, leaves, unavailability.

import { createAdminClient } from '@/lib/supabase/server'
import type { Employee, EmployeeLeave } from '@/types'

export async function getEmployees(orgId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('employees')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as Employee[]
}

export async function getEmployeesWithLeaves(orgId: string) {
  const admin = createAdminClient()
  const { data: employees } = await admin
    .from('employees')
    .select('*, employee_leaves(*), employee_unavailability(*)')
    .eq('organization_id', orgId)
    .order('name')
  return (employees ?? []) as any[]
}
