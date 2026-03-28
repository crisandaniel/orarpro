// Employees page — server component using DAL.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getEmployeesWithLeaves } from '@/lib/dal/employees'
import { EmployeeList } from '@/components/employees/EmployeeList'

interface Props { params: Promise<{ locale: string }> }

export default async function EmployeesPage({ params }: Props) {
  const { locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const employees = await getEmployeesWithLeaves(ctx.org.id)

  const leaves = employees.flatMap((e: any) => e.employee_leaves ?? [])
  const unavailability = employees.flatMap((e: any) => e.employee_unavailability ?? [])
  const cleanEmployees = employees.map((e: any) => {
    const { employee_leaves, employee_unavailability, ...emp } = e
    return emp
  })

  return (
    <div className="max-w-4xl mx-auto">
      <EmployeeList
        employees={cleanEmployees}
        leaves={leaves}
        unavailability={unavailability}
        organizationId={ctx.org.id}
        maxEmployees={ctx.org.max_employees}
        currentPlan={ctx.org.plan}
      />
    </div>
  )
}
