'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, Zap } from 'lucide-react'
import type { Employee, ShiftDefinition, Constraint } from '@/types'

const constraintSchema = z.object({
  type: z.enum([
    'pair_required', 'pair_forbidden', 'rest_after_shift',
    'max_consecutive', 'max_weekly_hours', 'max_night_shifts',
    'min_seniority', 'min_staff', 'fixed_shift',
  ]),
  employee_id: z.string().optional(),
  target_employee_id: z.string().optional(),
  shift_definition_id: z.string().optional(),
  value: z.number().optional(),
  note: z.string().optional(),
})

type ConstraintForm = z.infer<typeof constraintSchema>

const CONSTRAINT_LABELS: Record<string, { label: string; desc: string; needsValue?: string; needsTarget?: boolean; needsShift?: boolean }> = {
  pair_required:    { label: 'Must work together', desc: 'Two employees always in the same shift', needsTarget: true },
  pair_forbidden:   { label: 'Cannot work together', desc: 'Two employees never in the same shift', needsTarget: true },
  rest_after_shift: { label: 'Minimum rest after shift', desc: 'Hours of rest required after a specific shift', needsValue: 'Hours', needsShift: true },
  max_consecutive:  { label: 'Max consecutive working days', desc: 'Employee cannot work more than N days in a row', needsValue: 'Days' },
  max_weekly_hours: { label: 'Max hours per week', desc: 'Cap on total weekly working hours', needsValue: 'Hours' },
  max_night_shifts: { label: 'Max night shifts per week', desc: 'Limit night shifts for work-life balance', needsValue: 'Shifts' },
  min_seniority:    { label: 'Require senior in shift', desc: 'Each shift must have at least one senior employee', needsShift: true },
  min_staff:        { label: 'Minimum staff per shift', desc: 'Minimum number of employees required', needsValue: 'Employees', needsShift: true },
  fixed_shift:      { label: 'Fixed shift type', desc: 'Employee always works the same shift type', needsShift: true },
}

export default function ConstraintsPage() {
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string
  const supabase = createClient()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)

  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<ConstraintForm>({
    resolver: zodResolver(constraintSchema),
    defaultValues: { type: 'pair_required' },
  })

  const selectedType = watch('type')
  const meta = CONSTRAINT_LABELS[selectedType]

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) return

      const [emps, shifts, cons] = await Promise.all([
        supabase.from('employees').select('*').eq('organization_id', membership.organization_id).eq('is_active', true),
        supabase.from('shift_definitions').select('*').eq('organization_id', membership.organization_id),
        supabase.from('constraints').select('*').eq('schedule_id', scheduleId),
      ])

      setEmployees(emps.data as any ?? [])
      setShiftDefs(shifts.data as any ?? [])
      setConstraints(cons.data as any ?? [])
    }
    load()
  }, [scheduleId])

  async function onSubmit(data: ConstraintForm) {
    const { data: created, error } = await supabase
      .from('constraints')
      .insert({
        schedule_id: scheduleId,
        type: data.type,
        employee_id: data.employee_id || null,
        target_employee_id: data.target_employee_id || null,
        shift_definition_id: data.shift_definition_id || null,
        value: data.value || null,
        note: data.note || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) { toast.error('Failed to add constraint'); return }
    setConstraints((prev) => [...prev, created as any])
    setShowForm(false)
    reset()
    toast.success('Constraint added')
  }

  async function removeConstraint(id: string) {
    await supabase.from('constraints').delete().eq('id', id)
    setConstraints((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/generate`, { method: 'POST' })
      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error ?? 'Generation failed')
        return
      }

      toast.success(`Schedule generated! ${result.stats.filledSlots} assignments created.`)
      if (result.violations?.length > 0) {
        toast.warning(`${result.violations.length} constraints could not be fully satisfied.`)
      }

      router.push(`/schedules/${scheduleId}`)
    } catch {
      toast.error('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function getConstraintSummary(c: Constraint): string {
    const meta = CONSTRAINT_LABELS[c.type]
    const emp = employees.find((e) => e.id === c.employee_id)
    const target = employees.find((e) => e.id === c.target_employee_id)
    const shift = shiftDefs.find((s) => s.id === c.shift_definition_id)

    let parts: string[] = [meta?.label ?? c.type]
    if (emp) parts.push(`— ${emp.name}`)
    if (target) parts.push(`+ ${target.name}`)
    if (shift) parts.push(`(${shift.name})`)
    if (c.value) parts.push(`= ${c.value}`)

    return parts.join(' ')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Constraints</h1>
        <p className="text-gray-500 text-sm mt-1">Step 3 of 3 — Define scheduling rules</p>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="h-1.5 flex-1 rounded-full bg-indigo-600" />
        ))}
      </div>

      {/* Constraint list */}
      <div className="space-y-2 mb-6">
        {constraints.length === 0 && !showForm && (
          <div className="text-center py-8 text-gray-400 text-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            No constraints yet. You can add them now or skip and generate the schedule.
          </div>
        )}

        {constraints.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium">{getConstraintSummary(c)}</p>
              {c.note && <p className="text-xs text-gray-400 mt-0.5">{c.note}</p>}
            </div>
            <button
              onClick={() => removeConstraint(c.id)}
              className="text-gray-300 hover:text-red-500 transition-colors ml-3 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add constraint form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-5 mb-6">
          <h3 className="font-medium mb-4">New constraint</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Constraint type */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                {...register('type')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(CONSTRAINT_LABELS).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {meta && <p className="text-xs text-gray-400 mt-1">{meta.desc}</p>}
            </div>

            {/* Employee selector */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {meta?.needsTarget ? 'First employee' : 'Employee'} (leave blank for all)
              </label>
              <select
                {...register('employee_id')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.experience_level})</option>
                ))}
              </select>
            </div>

            {/* Second employee for pair constraints */}
            {meta?.needsTarget && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Second employee</label>
                <select
                  {...register('target_employee_id')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Shift selector */}
            {meta?.needsShift && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shift (leave blank for all)</label>
                <select
                  {...register('shift_definition_id')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All shifts</option>
                  {shiftDefs.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Numeric value */}
            {meta?.needsValue && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{meta.needsValue}</label>
                <input
                  {...register('value', { valueAsNumber: true })}
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input
                {...register('note')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Junior needs supervision"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Add constraint
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 mb-6"
        >
          <Plus className="w-4 h-4" />
          Add constraint
        </button>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      >
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating schedule...</>
        ) : (
          <><Zap className="w-4 h-4" /> Generate schedule</>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        The algorithm will try to satisfy all constraints. You can adjust manually afterwards.
      </p>
    </div>
  )
}
