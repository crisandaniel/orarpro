import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeList } from '@/components/employees/EmployeeList'

export default async function EmployeesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(max_employees, plan)')
    .eq('user_id', user.id)
    .single()

  const orgId = membership?.organization_id
  const org = membership?.organizations as any

  const [employeesResult, leavesResult, unavailResult] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('organization_id', orgId ?? '')
      .order('name'),
    supabase
      .from('employee_leaves')
      .select('*'),
    supabase
      .from('employee_unavailability')
      .select('*'),
  ])

  const employees = employeesResult.data ?? []
  const leaves = leavesResult.data ?? []
  const unavailability = unavailResult.data ?? []

  return (
    <div className="max-w-4xl mx-auto">
      <EmployeeList
        employees={employees as any}
        leaves={leaves as any}
        unavailability={unavailability as any}
        organizationId={orgId ?? ''}
        maxEmployees={org?.max_employees ?? 10}
        currentPlan={org?.plan ?? 'free'}
      />
    </div>
  )
}
