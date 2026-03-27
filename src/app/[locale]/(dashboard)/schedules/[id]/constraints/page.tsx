'use client'

// Step 3 of 3 — hard scheduling constraints.
// Allows: pair rules, rest requirements, max consecutive days, seniority rules.
// Calls POST/DELETE /api/schedules/[id]/constraints.
// 'Generează orarul' triggers POST /api/schedules/[id]/generate.
// Shows warning if no employees added yet.
// Used by: wizard flow after step 2.

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

export default function ConstraintsPage() {
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string
  const supabase = createClient()
  const tCon = useTranslations('constraints')
  const tCommon = useTranslations('common')

  // Built inside component so tCon is available
  const CONSTRAINT_LABELS: Record<string, {
    label: string
    desc: string
    needsValue?: string
    needsTarget?: boolean
    needsShift?: boolean
  }> = {
    pair_required:    { label: tCon('pairRequired'),    desc: tCon('pairRequired'),    needsTarget: true },
    pair_forbidden:   { label: tCon('pairForbidden'),   desc: tCon('pairForbidden'),   needsTarget: true },
    rest_after_shift: { label: tCon('restAfterShift'),  desc: tCon('restAfterShift'),  needsValue: 'Ore', needsShift: true },
    max_consecutive:  { label: tCon('maxConsecutive'),  desc: tCon('maxConsecutive'),  needsValue: 'Zile' },
    max_weekly_hours: { label: tCon('maxWeeklyHours'),  desc: tCon('maxWeeklyHours'),  needsValue: 'Ore' },
    max_night_shifts: { label: tCon('maxNightShifts'),  desc: tCon('maxNightShifts'),  needsValue: 'Ture' },
    min_seniority:    { label: tCon('minSeniority'),    desc: tCon('minSeniority'),    needsShift: true },
    min_staff:        { label: tCon('minStaff'),        desc: tCon('minStaff'),        needsValue: 'Angajați', needsShift: true },
    fixed_shift:      { label: tCon('fixedShift'),      desc: tCon('fixedShift'),      needsShift: true },
  }

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
    const res = await fetch(`/api/schedules/${scheduleId}/constraints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) { toast.error(result.error ?? tCommon('error')); return }
    setConstraints((prev) => [...prev, result.constraint])
    setShowForm(false)
    reset()
    toast.success(tCommon('success'))
  }

  async function removeConstraint(id: string) {
    await fetch(`/api/schedules/${scheduleId}/constraints`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ constraintId: id }),
    })
    setConstraints((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleGenerate() {
    setGenerating(true)
    const locale = window.location.pathname.split('/')[1] || 'ro'
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/generate`, { method: 'POST' })
      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error ?? tCommon('error'))
        return
      }

      toast.success(`${result.stats?.filledSlots ?? 0} atribuiri create.`)
      window.location.href = `/${locale}/schedules/${scheduleId}`
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setGenerating(false)
    }
  }

  function getConstraintSummary(c: Constraint): string {
    const labelMeta = CONSTRAINT_LABELS[c.type]
    const emp = employees.find((e) => e.id === c.employee_id)
    const target = employees.find((e) => e.id === c.target_employee_id)
    const shift = shiftDefs.find((s) => s.id === c.shift_definition_id)

    const parts: string[] = [labelMeta?.label ?? c.type]
    if (emp) parts.push(`— ${emp.name}`)
    if (target) parts.push(`+ ${target.name}`)
    if (shift) parts.push(`(${shift.name})`)
    if (c.value) parts.push(`= ${c.value}`)

    return parts.join(' ')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{tCon('title')}</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{tCon('step')}</p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="h-1.5 flex-1 rounded-full" style={{ background: '#2563eb' }} />
        ))}
      </div>

      {/* Constraint list */}
      <div className="space-y-2 mb-6">
        {constraints.length === 0 && !showForm && (
          <div className="text-center py-8 text-sm rounded-xl"
            style={{ color: '#9ca3af', background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
            {tCon('none')}
          </div>
        )}

        {constraints.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl"
            style={{ border: '0.5px solid #e5e7eb' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#111827' }}>{getConstraintSummary(c)}</p>
              {c.note && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.note}</p>}
            </div>
            <button onClick={() => removeConstraint(c.id)}
              className="ml-3 p-1 transition-colors hover:text-red-500"
              style={{ color: '#d1d5db' }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add constraint form */}
      {showForm && (
        <div className="bg-white rounded-xl p-5 mb-6"
          style={{ border: '0.5px solid #bfdbfe' }}>
          <h3 className="font-medium mb-4" style={{ color: '#111827' }}>{tCon('new')}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Constraint type */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                {tCon('type')}
              </label>
              <select {...register('type')}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}>
                {Object.entries(CONSTRAINT_LABELS).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {meta && <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{meta.desc}</p>}
            </div>

            {/* Employee */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                {meta?.needsTarget ? tCon('employee') : tCon('employee')} ({tCommon('optional')})
              </label>
              <select {...register('employee_id')}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}>
                <option value="">{tCon('allEmployees')}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.experience_level})</option>
                ))}
              </select>
            </div>

            {/* Second employee for pair constraints */}
            {meta?.needsTarget && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                  {tCon('secondEmployee')}
                </label>
                <select {...register('target_employee_id')}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}>
                  <option value="">{tCon('allEmployees')}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Shift selector */}
            {meta?.needsShift && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                  {tCon('shift')}
                </label>
                <select {...register('shift_definition_id')}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}>
                  <option value="">{tCon('allEmployees')}</option>
                  {shiftDefs.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Numeric value */}
            {meta?.needsValue && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                  {meta.needsValue}
                </label>
                <input {...register('value', { valueAsNumber: true })}
                  type="number" min={1}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
                {tCon('note')}
              </label>
              <input {...register('note')}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}
                placeholder={tCon('notePlaceholder')} />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#2563eb' }}>
                {tCon('add')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '0.5px solid #d1d5db', color: '#374151' }}>
                {tCommon('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add constraint button */}
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 mb-6 transition-colors"
          style={{ border: '2px dashed #e5e7eb', color: '#9ca3af' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.color = '#2563eb' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af' }}>
          <Plus className="w-4 h-4" />
          {tCon('add')}
        </button>
      )}

      {/* No employees warning */}
      {employees.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-4"
          style={{ background: '#fffbeb', border: '0.5px solid #fde68a' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706"
            strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: '#92400e' }}>
              {tCon('noEmployeesWarning')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
              {tCon('noEmployeesHint', { link: tCon('employeesLink') })}
            </p>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={generating}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        style={{ background: '#2563eb' }}>
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {tCommon('loading')}</>
        ) : (
          <><Zap className="w-4 h-4" /> {tCon('generateBtn')}</>
        )}
      </button>

      <p className="text-xs text-center mt-3" style={{ color: '#9ca3af' }}>
        {tCon('generateHint')}
      </p>
    </div>
  )
}