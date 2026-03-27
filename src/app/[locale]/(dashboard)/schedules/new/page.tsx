'use client'

// Step 1 of 3 in the schedule creation wizard — basic settings.
// Collects: name, type (shifts/school), date range, working days, holidays, country.
// Calls POST /api/schedules, then redirects to /[id]/setup.
// Used by: 'Orar nou' button on dashboard and schedules list.



import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Factory, GraduationCap, ChevronRight, Loader2 } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'

const step1Schema = z.object({
  name: z.string().min(2),
  type: z.enum(['shifts', 'school']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  countryCode: z.string().min(2),
  includeHolidays: z.boolean(),
  workingDays: z.array(z.number()).min(1),
})

type Step1Form = z.infer<typeof step1Schema>

export default function NewSchedulePage() {
  const t = useTranslations('schedule')
  const tCommon = useTranslations('common')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<Step1Form>({
      resolver: zodResolver(step1Schema),
      defaultValues: { type: 'shifts', countryCode: 'RO', includeHolidays: false, workingDays: [1, 2, 3, 4, 5] },
    })

  const scheduleType = watch('type')
  const includeHolidays = watch('includeHolidays')

  const days = [
    { value: 1, label: t('mon') }, { value: 2, label: t('tue') },
    { value: 3, label: t('wed') }, { value: 4, label: t('thu') },
    { value: 5, label: t('fri') }, { value: 6, label: t('sat') },
    { value: 7, label: t('sun') },
  ]

  const countries = [
    { code: 'RO', name: 'România' }, { code: 'DE', name: 'Germania' },
    { code: 'FR', name: 'Franța' }, { code: 'ES', name: 'Spania' },
    { code: 'IT', name: 'Italia' }, { code: 'GB', name: 'Regatul Unit' },
    { code: 'PL', name: 'Polonia' }, { code: 'HU', name: 'Ungaria' },
    { code: 'BG', name: 'Bulgaria' }, { code: 'US', name: 'SUA' },
  ]

  function toggleDay(day: number) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort()
    setSelectedDays(next)
    setValue('workingDays', next)
  }

  async function onSubmit(data: Step1Form) {
    const locale = window.location.pathname.split('/')[1] || 'ro'
    let res: Response
    try {
      res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name, type: data.type,
          startDate: data.startDate, endDate: data.endDate,
          workingDays: data.workingDays,
          includeHolidays: data.includeHolidays,
          countryCode: data.countryCode,
        }),
      })
    } catch {
      toast.error(tCommon('error')); return
    }
    const result = await res.json()
    if (!res.ok) { toast.error(result.error ?? tCommon('error')); return }
    window.location.href = `/${locale}/schedules/${result.scheduleId}/setup`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{t('new')}</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{t('step1')}</p>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="h-1.5 flex-1 rounded-full"
            style={{ background: s === 1 ? '#2563eb' : '#f3f4f6' }} />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: '#374151' }}>{t('type')}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'shifts', icon: Factory, title: t('typeShifts').split('(')[0].trim(), desc: t('shiftsDesc') },
              { value: 'school', icon: GraduationCap, title: t('typeSchool').split('/')[0].trim(), desc: t('schoolDesc') },
            ].map(({ value, icon: Icon, title, desc }) => (
              <label key={value}
                className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors"
                style={{
                  borderColor: scheduleType === value ? '#2563eb' : '#e5e7eb',
                  background: scheduleType === value ? '#eff6ff' : '#fff',
                }}>
                <input {...register('type')} type="radio" value={value} className="sr-only" />
                <Icon className="w-5 h-5 mt-0.5 shrink-0"
                  style={{ color: scheduleType === value ? '#2563eb' : '#9ca3af' }} />
                <div>
                  <p className="font-medium text-sm"
                    style={{ color: scheduleType === value ? '#1d4ed8' : '#111827' }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('name')}</label>
          <input {...register('name')}
            className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}
            placeholder={scheduleType === 'school' ? 'Semestrul 1 2024-2025' : 'Săptămâna 23 — Bucătărie'}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DatePicker label={t('startDate')} value={watch('startDate') ?? ''}
            onChange={(d) => setValue('startDate', d)}
            placeholder={t('selectStartDate')} error={errors.startDate?.message} />
          <DatePicker label={t('endDate')} value={watch('endDate') ?? ''}
            onChange={(d) => setValue('endDate', d)}
            placeholder={t('selectEndDate')} minDate={watch('startDate')}
            error={errors.endDate?.message} />
        </div>

        {/* Working days */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: '#374151' }}>{t('workingDays')}</label>
          <div className="flex gap-2">
            {days.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => toggleDay(value)}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: selectedDays.includes(value) ? '#2563eb' : '#f3f4f6',
                  color: selectedDays.includes(value) ? '#fff' : '#6b7280',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Holidays */}
        <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
          style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: '#111827' }}>
              {includeHolidays ? t('holidaysWork') : t('holidaysOff')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              {includeHolidays ? t('holidaysWorkHint') : t('holidaysOffHint')}
            </p>
          </div>
          <input {...register('includeHolidays')} type="checkbox"
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
        </label>

        {/* Country */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('country')}</label>
          <select {...register('countryCode')}
            className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}>
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: '#2563eb' }}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {t('continueShifts')}
        </button>
      </form>
    </div>
  )
}
