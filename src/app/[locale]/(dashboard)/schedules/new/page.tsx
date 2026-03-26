'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Factory, GraduationCap, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Step 1: Choose type + basic info
const step1Schema = z.object({
  name: z.string().min(2, 'Name is required'),
  type: z.enum(['shifts', 'school']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  countryCode: z.string().min(2),
  includeHolidays: z.boolean(),
  workingDays: z.array(z.number()).min(1, 'Select at least one working day'),
})

type Step1Form = z.infer<typeof step1Schema>

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

export default function NewSchedulePage() {
  const router = useRouter()
  const supabase = createClient()
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      type: 'shifts',
      countryCode: 'RO',
      includeHolidays: true,
      workingDays: [1, 2, 3, 4, 5],
    },
  })

  const scheduleType = watch('type')

  function toggleDay(day: number) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort()
    setSelectedDays(next)
    setValue('workingDays', next)
  }

  async function onSubmit(data: Step1Form) {
    // Get user's organization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      toast.error('No organization found. Please set up your organization first.')
      return
    }

    const { data: schedule, error } = await supabase
      .from('schedules')
      .insert({
        organization_id: membership.organization_id,
        name: data.name,
        type: data.type,
        start_date: data.startDate,
        end_date: data.endDate,
        working_days: data.workingDays,
        include_holidays: data.includeHolidays,
        country_code: data.countryCode,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !schedule) {
      toast.error('Failed to create schedule')
      return
    }

    router.push(`/schedules/${schedule.id}/setup`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">New schedule</h1>
        <p className="text-gray-500 text-sm mt-1">Step 1 of 3 — Basic settings</p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              step === 1 ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'
            )}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Schedule type */}
        <div>
          <label className="block text-sm font-medium mb-3">Schedule type</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                value: 'shifts',
                icon: Factory,
                title: 'Shifts',
                desc: 'HoReCa, factories, retail',
              },
              {
                value: 'school',
                icon: GraduationCap,
                title: 'School timetable',
                desc: 'Schools, universities',
              },
            ].map(({ value, icon: Icon, title, desc }) => (
              <label
                key={value}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                  scheduleType === value
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                )}
              >
                <input
                  {...register('type')}
                  type="radio"
                  value={value}
                  className="sr-only"
                />
                <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', scheduleType === value ? 'text-indigo-600' : 'text-gray-400')} />
                <div>
                  <p className={cn('font-medium text-sm', scheduleType === value && 'text-indigo-700 dark:text-indigo-400')}>{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Schedule name */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Schedule name</label>
          <input
            {...register('name')}
            type="text"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={scheduleType === 'school' ? 'Semester 1 2024-2025' : 'Week 23 — Kitchen team'}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Start date</label>
            <input
              {...register('startDate')}
              type="date"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End date</label>
            <input
              {...register('endDate')}
              type="date"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        {/* Working days */}
        <div>
          <label className="block text-sm font-medium mb-3">Working days</label>
          <div className="flex gap-2">
            {DAYS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                  selectedDays.includes(value)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.workingDays && <p className="text-red-500 text-xs mt-1">{errors.workingDays.message}</p>}
        </div>

        {/* Country + holidays */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <div>
            <p className="text-sm font-medium">Include public holidays</p>
            <p className="text-xs text-gray-500 mt-0.5">Holidays will be marked on the calendar</p>
          </div>
          <input
            {...register('includeHolidays')}
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Country</label>
          <select
            {...register('countryCode')}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="RO">Romania</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="ES">Spain</option>
            <option value="IT">Italy</option>
            <option value="GB">United Kingdom</option>
            <option value="PL">Poland</option>
            <option value="HU">Hungary</option>
            <option value="BG">Bulgaria</option>
            <option value="US">United States</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          Continue to shift setup
        </button>
      </form>
    </div>
  )
}
