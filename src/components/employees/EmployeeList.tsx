'use client'

// Full employee management UI — add, edit, deactivate, view leaves.
// Add/edit/toggle calls /api/employees (admin API bypasses RLS).
// Leave management (inline sub-form) uses Supabase browser client directly.
// Shows upgrade prompt when plan employee limit is reached.
// Used by: employees/page.tsx.



import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/ui/DatePicker'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
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
  const tEmp = useTranslations('employees')
  const tCommon = useTranslations('common')
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
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...data }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Failed to update employee'); return }
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? result.employee : e)))
      toast.success(tCommon("success"))
    } else {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Failed to add employee'); return }
      setEmployees((prev) => [...prev, result.employee])
      toast.success(tCommon("success"))
    }

    setShowForm(false)
    setEditingId(null)
    reset()
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: emp.id, is_active: !emp.is_active,
        name: emp.name, experience_level: emp.experience_level, color: emp.color }),
    })
    if (!res.ok) { toast.error('Failed to update'); return }
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
          <h1 className="text-2xl font-semibold">{tEmp("title")}</h1>
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
        <div className="bg-white rounded-xl p-5 mb-4" style={{border: "0.5px solid #bfdbfe"}}>
          <h3 className="font-medium mb-4">{editingId ? 'Editează angajat' : 'Angajat nou'}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Color picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">{tEmp("color")}</label>
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
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{border:"0.5px solid #d1d5db",color:"#111827",background:"#fff"}}
                  placeholder="Ion Popescu"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{tEmp("level")}</label>
                <select
                  {...register('experience_level')}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{border:"0.5px solid #d1d5db",color:"#111827",background:"#fff"}}
                >
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{tEmp("email")}</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{border:"0.5px solid #d1d5db",color:"#111827",background:"#fff"}}
                  placeholder="ion@example.com"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{tEmp("phone")}</label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{border:"0.5px solid #d1d5db",color:"#111827",background:"#fff"}}
                  placeholder="+40 721 000 000"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50" style={{background:"#2563eb"}}
              >
                {editingId ? 'Salvează modificările' : 'Adaugă angajat'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{border:"0.5px solid #d1d5db",color:"#374151"}}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl" style={{border: "0.5px solid #e5e7eb"}}>
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">{tEmp("noEmployees")}</p>
          <p className="text-gray-400 text-sm">{tEmp("noEmployeesHint")}</p>
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
                  'bg-white rounded-xl border transition-colors' + " border-gray-200",
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
                      <span className="px-2 py-0.5 rounded-full" style={{background:"#eff6ff",color:"#1d4ed8"}}>
                        {empLeaves.length} leave{empLeaves.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {!emp.is_active && (
                      <span className="px-2 py-0.5 rounded-full" style={{background:"#f3f4f6",color:"#6b7280"}}>
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
  const router = useRouter()
  const tEmp = useTranslations('employees')
  const tCommon = useTranslations('common')
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [currentLeaves, setCurrentLeaves] = useState(leaves)
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm<z.infer<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
  })

  async function addLeave(data: z.infer<typeof leaveSchema>) {
    const res = await fetch('/api/employees/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employee.id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || null,
      }),
    })
    const result = await res.json()
    if (!res.ok) { toast.error(result.error ?? 'Failed to add leave'); return }
    setCurrentLeaves((prev) => [...prev, result.data])
    setShowLeaveForm(false)
    reset()
    setLeaveStart('')
    setLeaveEnd('')
    toast.success(tEmp('leaves'))
  }

  async function removeLeave(id: string) {
    await fetch('/api/employees/leaves', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaveId: id }),
    })
    setCurrentLeaves((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-4">
      {/* Leaves */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tEmp("leavesTitle")}</p>
          <button
            onClick={() => setShowLeaveForm(!showLeaveForm)}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {showLeaveForm && (
          <form onSubmit={handleSubmit(addLeave)} className="flex flex-col gap-2 mb-2 p-3 rounded-lg" style={{background:"#f9fafb"}}>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                label={tEmp('leaveStart')}
                value={leaveStart}
                onChange={(d) => { setLeaveStart(d); setValue('start_date', d) }}
                placeholder="Alege data"
              />
              <DatePicker
                label={tEmp('leaveEnd')}
                value={leaveEnd}
                onChange={(d) => { setLeaveEnd(d); setValue('end_date', d) }}
                placeholder="Alege data"
                minDate={leaveStart}
              />
            </div>
            <input {...register('reason')} placeholder="Motiv (opțional)" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-32" />
            <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 text-white rounded text-xs font-medium" style={{background:"#2563eb"}}>Salvează</button>
            <button type="button" onClick={() => setShowLeaveForm(false)} className="px-3 py-1.5 rounded text-xs" style={{border:"0.5px solid #d1d5db",color:"#374151"}}>{tCommon("cancel")}</button>
          </form>
        )}

        {currentLeaves.length === 0 ? (
          <p className="text-xs text-gray-400">{tEmp("noLeaves")}</p>
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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{tEmp("unavailability")}</p>
          <div className="flex flex-wrap gap-1.5">
            {unavailability.map((u) => (
              <span key={u.id} className="text-xs px-2 py-0.5 rounded-full" style={{background:"#f3f4f6",color:"#6b7280"}}>
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