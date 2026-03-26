'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Employee, EmployeeLeave, EmployeeUnavailability } from '@/types'
import Link from 'next/link'

const employeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  experience_level: z.enum(['junior', 'mid', 'senior']),
  color: z.string(),
})

type EmployeeForm = z.infer<typeof employeeSchema>

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#64748b',
]

interface EmployeeListProps {
  employees: Employee[]
  leaves: EmployeeLeave[]
  unavailability: EmployeeUnavailability[]
  organizationId: string
  maxEmployees: number
  currentPlan: string
}

export function EmployeeList({
  employees: initialEmployees,
  leaves,
  unavailability,
  organizationId,
  maxEmployees,
  currentPlan,
}: EmployeeListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState(initialEmployees)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const atLimit = employees.filter((e) => e.is_active).length >= maxEmployees

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { experience_level: 'mid', color: COLORS[0] },
  })

  const selectedColor = watch('color')

  function startAdd() {
    reset({ experience_level: 'mid', color: COLORS[employees.length % COLORS.length] })
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(emp: Employee) {
    reset({
      name: emp.name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      experience_level: emp.experience_level,
      color: emp.color ?? COLORS[0],
    })
    setEditingId(emp.id)
    setShowForm(true)
  }

  async function onSubmit(data: EmployeeForm) {
    if (editingId) {
      const { data: updated, error } = await supabase
        .from('employees')
        .update({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          experience_level: data.experience_level,
          color: data.color,
        })
        .eq('id', editingId)
        .select()
        .single()

      if (error) { toast.error('Failed to update employee'); return }
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? (updated as any) : e)))
      toast.success('Employee updated')
    } else {
      const { data: created, error } = await supabase
        .from('employees')
        .insert({
          organization_id: organizationId,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          experience_level: data.experience_level,
          color: data.color,
        })
        .select()
        .single()

      if (error) { toast.error('Failed to add employee'); return }
      setEmployees((prev) => [...prev, created as any])
      toast.success('Employee added')
    }

    setShowForm(false)
    setEditingId(null)
    reset()
  }

  async function toggleActive(emp: Employee) {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id)

    if (error) { toast.error('Failed to update'); return }
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
    )
  }

  const activeCount = employees.filter((e) => e.is_active).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount} / {maxEmployees} active
          </p>
        </div>

        {atLimit ? (
          <Link
            href="/billing"
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Limit reached — Upgrade
          </Link>
        ) : (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add employee
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-5 mb-4">
          <h3 className="font-medium mb-4">{editingId ? 'Edit employee' : 'New employee'}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Color picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={cn(
                      'w-6 h-6 rounded-full transition-transform',
                      selectedColor === color && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ion Popescu"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Experience level</label>
                <select
                  {...register('experience_level')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Email (optional)</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="ion@example.com"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone (optional)</label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+40 721 000 000"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {editingId ? 'Save changes' : 'Add employee'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">No employees yet</p>
          <p className="text-gray-400 text-sm">Add your team members to start building schedules</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => {
            const empLeaves = leaves.filter((l) => l.employee_id === emp.id)
            const empUnavail = unavailability.filter((u) => u.employee_id === emp.id)
            const isExpanded = expandedId === emp.id

            return (
              <div
                key={emp.id}
                className={cn(
                  'bg-white dark:bg-gray-900 rounded-xl border transition-colors',
                  emp.is_active
                    ? 'border-gray-200 dark:border-gray-800'
                    : 'border-gray-100 dark:border-gray-800/50 opacity-60'
                )}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Color dot + name */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{ background: emp.color ?? '#6366f1' }}
                  >
                    {emp.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{emp.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{emp.experience_level}{emp.email ? ` · ${emp.email}` : ''}</p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {empLeaves.length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-full">
                        {empLeaves.length} leave{empLeaves.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {!emp.is_active && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(emp)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(emp)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      title={emp.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: leaves + unavailability */}
                {isExpanded && (
                  <EmployeeDetails
                    employee={emp}
                    leaves={empLeaves}
                    unavailability={empUnavail}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Employee details subcomponent ───────────────────────────────────────────

const leaveSchema = z.object({
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().optional(),
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function EmployeeDetails({
  employee,
  leaves,
  unavailability,
}: {
  employee: Employee
  leaves: EmployeeLeave[]
  unavailability: EmployeeUnavailability[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [currentLeaves, setCurrentLeaves] = useState(leaves)

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<z.infer<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
  })

  async function addLeave(data: z.infer<typeof leaveSchema>) {
    const { data: created, error } = await supabase
      .from('employee_leaves')
      .insert({
        employee_id: employee.id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || null,
      })
      .select()
      .single()

    if (error) { toast.error('Failed to add leave'); return }
    setCurrentLeaves((prev) => [...prev, created as any])
    setShowLeaveForm(false)
    reset()
    toast.success('Leave added')
  }

  async function removeLeave(id: string) {
    await supabase.from('employee_leaves').delete().eq('id', id)
    setCurrentLeaves((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-4">
      {/* Leaves */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Leaves / Vacation</p>
          <button
            onClick={() => setShowLeaveForm(!showLeaveForm)}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {showLeaveForm && (
          <form onSubmit={handleSubmit(addLeave)} className="flex flex-wrap gap-2 mb-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <input {...register('start_date')} type="date" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input {...register('end_date')} type="date" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input {...register('reason')} placeholder="Reason (optional)" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-32" />
            <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium">Save</button>
            <button type="button" onClick={() => setShowLeaveForm(false)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs">Cancel</button>
          </form>
        )}

        {currentLeaves.length === 0 ? (
          <p className="text-xs text-gray-400">No leaves scheduled</p>
        ) : (
          <div className="space-y-1">
            {currentLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>
                  {leave.start_date} → {leave.end_date}
                  {leave.reason && <span className="text-gray-400 ml-1">({leave.reason})</span>}
                </span>
                <button onClick={() => removeLeave(leave.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unavailability */}
      {unavailability.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recurring unavailability</p>
          <div className="flex flex-wrap gap-1.5">
            {unavailability.map((u) => (
              <span key={u.id} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {u.day_of_week !== null ? DAY_NAMES[u.day_of_week] : u.specific_date}
                {u.note && ` · ${u.note}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
