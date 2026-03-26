import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { AISuggestionsPanel } from '@/components/schedule/AISuggestionsPanel'
import { getHolidaysInRange } from '@/lib/holidays'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScheduleViewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const [scheduleResult, assignmentsResult, employeesResult, shiftDefsResult] = await Promise.all([
    supabase.from('schedules').select('*').eq('id', id).single(),
    supabase.from('shift_assignments').select('*, employees(name, color), shift_definitions(name, color, start_time, end_time, shift_type)').eq('schedule_id', id),
    supabase.from('employees').select('*'),
    supabase.from('shift_definitions').select('*'),
  ])

  if (scheduleResult.error || !scheduleResult.data) notFound()

  const schedule = scheduleResult.data
  const assignments = assignmentsResult.data ?? []
  const employees = employeesResult.data ?? []
  const shiftDefs = shiftDefsResult.data ?? []

  // Fetch public holidays
  const holidays = schedule.include_holidays
    ? await getHolidaysInRange(schedule.country_code, schedule.start_date, schedule.end_date)
    : []

  const aiSuggestions = schedule.ai_suggestions as any[] | null

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{schedule.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(schedule.start_date), 'd MMM')} –{' '}
            {format(new Date(schedule.end_date), 'd MMM yyyy')}
            {' · '}
            {employees.length} employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          {schedule.status === 'generated' && (
            <PublishButton scheduleId={id} />
          )}
          {schedule.status === 'draft' && (
            <GenerateButton scheduleId={id} />
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main schedule grid */}
        <div className="flex-1 min-w-0">
          <ScheduleGrid
            schedule={schedule as any}
            assignments={assignments as any}
            employees={employees as any}
            shiftDefinitions={shiftDefs as any}
            holidays={holidays}
          />
        </div>

        {/* AI suggestions sidebar */}
        {aiSuggestions && aiSuggestions.length > 0 && (
          <div className="w-72 shrink-0">
            <AISuggestionsPanel suggestions={aiSuggestions} />
          </div>
        )}
      </div>
    </div>
  )
}

function GenerateButton({ scheduleId }: { scheduleId: string }) {
  return (
    <form action={`/api/schedules/${scheduleId}/generate`} method="POST">
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Generate schedule
      </button>
    </form>
  )
}

function PublishButton({ scheduleId }: { scheduleId: string }) {
  return (
    <form action={`/api/schedules/${scheduleId}/publish`} method="POST">
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Publish
      </button>
    </form>
  )
}
