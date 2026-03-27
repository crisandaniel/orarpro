'use client'

// Step 2 of 3 — shift definitions and generation rules.
// Collects: shift types (name, hours, color, slots/day), legal limits, min/max rules.
// Calls POST /api/schedules/[id]/setup, then redirects to /constraints.
// Used by: wizard flow after step 1.



import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronRight, Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const shiftSchema = z.object({
  name: z.string().min(1),
  shift_type: z.enum(['morning', 'afternoon', 'night', 'custom']),
  start_time: z.string(),
  end_time: z.string(),
  crosses_midnight: z.boolean(),
  color: z.string(),
  slots_per_day: z.number().min(1).max(20),
})

const setupSchema = z.object({
  shifts: z.array(shiftSchema).min(1, 'Add at least one shift'),
  // Generation config
  min_employees_per_shift: z.number().min(1),
  max_consecutive_days: z.number().min(1).max(7),
  min_rest_hours: z.number().min(0).max(24),
  max_weekly_hours: z.number().min(1).max(80),
  max_night_shifts_per_week: z.number().min(0).max(7),
  enforce_legal_limits: z.boolean(),
  balance_distribution: z.boolean(),
})

type SetupForm = z.infer<typeof setupSchema>

const SHIFT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
]

export default function ScheduleSetupPage() {
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string
  const [scheduleType, setScheduleType] = useState<'shifts' | 'school'>('shifts')

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      shifts: [
        { name: 'Morning', shift_type: 'morning', start_time: '06:00', end_time: '14:00', crosses_midnight: false, color: '#10b981', slots_per_day: 1 },
      ],
      min_employees_per_shift: 2,
      max_consecutive_days: 6,
      min_rest_hours: 11,
      max_weekly_hours: 48,
      max_night_shifts_per_week: 2,
      enforce_legal_limits: true,
      balance_distribution: true,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'shifts' })

  useEffect(() => {
    fetch(`/api/schedules/${scheduleId}/type`)
      .then((r) => r.json())
      .then((data) => {
        if (data.type) setScheduleType(data.type as 'shifts' | 'school')
      })
      .catch(() => {})
  }, [scheduleId])

  async function onSubmit(data: SetupForm) {
    const locale = window.location.pathname.split('/')[1] || 'ro'

    const res = await fetch(`/api/schedules/${scheduleId}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shifts: data.shifts,
        generationConfig: {
          min_employees_per_shift: data.min_employees_per_shift,
          max_consecutive_days: data.max_consecutive_days,
          min_rest_hours: data.min_rest_hours,
          max_weekly_hours: data.max_weekly_hours,
          max_night_shifts_per_week: data.max_night_shifts_per_week,
          enforce_legal_limits: data.enforce_legal_limits,
          balance_distribution: data.balance_distribution,
        },
      }),
    })

    const result = await res.json()
    if (!res.ok) {
      toast.error(result.error ?? 'Failed to save shifts')
      return
    }

    window.location.href = `/${locale}/schedules/${scheduleId}/constraints`
  }

  const enforceLegal = watch('enforce_legal_limits')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Configurare ture</h1>
        <p className="text-gray-500 text-sm mt-1">Pasul 2 din 3 — Definește turele și regulile</p>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className={cn('h-1.5 flex-1 rounded-full', step <= 2 ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800')} />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Shift definitions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">
              {scheduleType === 'school' ? 'Intervale orare' : 'Tipuri de ture'}
            </label>
            <button
              type="button"
              onClick={() => append({ name: '', shift_type: 'custom', start_time: '08:00', end_time: '16:00', crosses_midnight: false, color: SHIFT_COLORS[fields.length % SHIFT_COLORS.length], slots_per_day: 1 })}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add shift
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-3">
                  {/* Color picker */}
                  <div className="flex gap-1.5 flex-wrap">
                    {SHIFT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue(`shifts.${i}.color`, color)}
                        className={cn('w-5 h-5 rounded-full transition-transform', watch(`shifts.${i}.color`) === color && 'ring-2 ring-offset-1 ring-gray-400 scale-110')}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nume</label>
                    <input
                      {...register(`shifts.${i}.name`)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Morning"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Angajați / zi</label>
                    <input
                      {...register(`shifts.${i}.slots_per_day`, { valueAsNumber: true })}
                      type="number"
                      min={1}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ora început</label>
                    <input
                      {...register(`shifts.${i}.start_time`)}
                      type="time"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ora sfârșit</label>
                    <input
                      {...register(`shifts.${i}.end_time`)}
                      type="time"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input {...register(`shifts.${i}.crosses_midnight`)} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  Crosses midnight (e.g. 22:00 → 06:00)
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Generation rules */}
        <div>
          <h3 className="text-sm font-medium mb-3">Reguli de generare</h3>

          {/* Legal limits toggle */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 mb-4">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Limite legale UE</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Min 11h repaus între ture, max 48h/săptămână, max 6 zile consecutive</p>
            </div>
            <input {...register('enforce_legal_limits')} type="checkbox" className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'min_employees_per_shift' as const, label: 'Min angajați / tură', min: 1, max: 50, disabled: false },
              { name: 'max_consecutive_days' as const, label: 'Max zile consecutive', min: 1, max: 7, disabled: enforceLegal },
              { name: 'min_rest_hours' as const, label: 'Min repaus între ture (ore)', min: 0, max: 24, disabled: enforceLegal },
              { name: 'max_weekly_hours' as const, label: 'Max ore / săptămână', min: 1, max: 80, disabled: enforceLegal },
              { name: 'max_night_shifts_per_week' as const, label: 'Max ture de noapte / săptămână', min: 0, max: 7, disabled: false },
            ].map(({ name, label, min, max, disabled }) => (
              <div key={name}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  {...register(name, { valueAsNumber: true })}
                  type="number"
                  min={min}
                  max={max}
                  disabled={disabled}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-4">
            <input {...register('balance_distribution')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            Balance hours equally across employees
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          Continue to constraints
        </button>
      </form>
    </div>
  )
}

// Workaround for disabled state in map
