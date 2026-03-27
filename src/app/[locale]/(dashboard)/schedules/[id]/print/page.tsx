// Print/PDF preview page — opens in a new tab from the schedule view.
// Shows only the schedule grid (no sidebar, no header, no nav).
// Has a Download PDF button that triggers window.print() + CSS @media print.
// Used by: ScheduleActions "Print / PDF" button.

import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { getHolidaysInRange } from '@/lib/holidays'
import { PrintScheduleGrid } from '@/components/schedule/PrintScheduleGrid'
import { PrintButton } from '@/components/schedule/PrintButton'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

export default async function PrintPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: schedule } = await admin.from('schedules').select('*').eq('id', id).single()
  if (!schedule) notFound()

  const { data: assignments } = await admin
    .from('shift_assignments')
    .select('*, employees(name, color), shift_definitions(name, color, start_time, end_time, shift_type)')
    .eq('schedule_id', id)

  const { data: scheduleShifts } = await admin
    .from('schedule_shifts')
    .select('shift_definition_id, shift_definitions(*)')
    .eq('schedule_id', id)

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(name)')
    .eq('user_id', user.id)
    .single()

  const { data: employees } = await admin
    .from('employees')
    .select('*')
    .eq('organization_id', (membership as any)?.organization_id ?? '')
    .eq('is_active', true)
    .order('name')

  const shiftDefs = (scheduleShifts ?? []).map((ss: any) => ss.shift_definitions).filter(Boolean)
  const orgName = (membership as any)?.organizations?.name ?? ''

  const holidays = schedule.include_holidays
    ? await getHolidaysInRange(schedule.country_code, schedule.start_date, schedule.end_date)
    : []

  const dateRange = `${format(new Date(schedule.start_date), 'd MMM yyyy')} – ${format(new Date(schedule.end_date), 'd MMM yyyy')}`

  return (
    <html lang="ro">
      <head>
        <title>{schedule.name} — {orgName}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fc; }

          .page { max-width: 1100px; margin: 0 auto; padding: 24px; }

          .toolbar {
            display: flex; align-items: center; justify-content: space-between;
            background: white; border: 0.5px solid #e5e7eb; border-radius: 12px;
            padding: 14px 20px; margin-bottom: 20px;
          }
          .toolbar h1 { font-size: 18px; font-weight: 600; color: #111827; }
          .toolbar p { font-size: 13px; color: #6b7280; margin-top: 2px; }

          .btn-download {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;
            background: #2563eb; color: white; font-size: 13px; font-weight: 500;
          }
          .btn-download:hover { background: #1d4ed8; }

          @media print {
            body { background: white; }
            .toolbar { display: none !important; }
            .page { padding: 0; max-width: 100%; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            @page { margin: 8mm; size: landscape; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Toolbar — hidden in print */}
          <div className="toolbar">
            <div>
              <h1>{schedule.name}</h1>
              <p>{orgName} · {dateRange} · {employees?.length ?? 0} angajați</p>
            </div>
            <PrintButton />
          </div>

          {/* Grid */}
          <PrintScheduleGrid
            schedule={schedule as any}
            assignments={(assignments ?? []) as any}
            employees={(employees ?? []) as any}
            shiftDefinitions={shiftDefs as any}
            holidays={holidays}
          />
        </div>


      </body>
    </html>
  )
}