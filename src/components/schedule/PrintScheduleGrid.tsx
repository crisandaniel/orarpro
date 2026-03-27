// PrintScheduleGrid — static version of the grid for print/PDF export.
// Renders ALL weeks at once (no pagination), no interactive buttons.
// Shows both views stacked if needed, or just the shifts view by default.
// Used by: schedules/[id]/print/page.tsx.

import { format, parseISO, eachDayOfInterval } from 'date-fns'
import type { Schedule, Employee, ShiftAssignment, ShiftDefinition } from '@/types'
import type { PublicHoliday } from '@/lib/holidays'

interface Props {
  schedule: Schedule
  assignments: (ShiftAssignment & {
    employees: { name: string; color: string }
    shift_definitions: { name: string; start_time: string; end_time: string }
  })[]
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  holidays: PublicHoliday[]
}

const SHIFT_STYLES = [
  { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e', borderW: 3 },
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d', borderW: 5 },
  { bg: '#fef3c7', border: '#d97706', text: '#78350f', borderW: 7 },
  { bg: '#fce7f3', border: '#db2777', text: '#831843', borderW: 3 },
  { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95', borderW: 5 },
  { bg: '#fff7ed', border: '#ea580c', text: '#7c2d12', borderW: 7 },
]

const DAY_NAMES = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
const WEEK_SIZE = 7

export function PrintScheduleGrid({ schedule, assignments, shiftDefinitions, holidays }: Props) {
  const allDates = eachDayOfInterval({
    start: parseISO(schedule.start_date),
    end: parseISO(schedule.end_date),
  }).map((d) => format(d, 'yyyy-MM-dd'))

  const totalWeeks = Math.ceil(allDates.length / WEEK_SIZE)

  // shiftId → date → names[]
  const shiftDateMap: Record<string, Record<string, string[]>> = {}
  for (const a of assignments) {
    const sid = a.shift_definition_id
    const name = (a as any).employees?.name ?? '?'
    if (!shiftDateMap[sid]) shiftDateMap[sid] = {}
    if (!shiftDateMap[sid][a.date]) shiftDateMap[sid][a.date] = []
    shiftDateMap[sid][a.date].push(name)
  }

  const holidayMap: Record<string, PublicHoliday> = {}
  holidays.forEach((h) => { holidayMap[h.date] = h })

  const isOff = (date: string) => {
    const dow = parseISO(date).getDay()
    return !schedule.working_days?.includes(dow === 0 ? 7 : dow)
  }

  const weeks = Array.from({ length: totalWeeks }, (_, wi) =>
    allDates.slice(wi * WEEK_SIZE, (wi + 1) * WEEK_SIZE)
  )

  return (
    <div>
      {weeks.map((weekDates, wi) => (
        <div key={wi} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
          {/* Week header */}
          <div style={{
            fontSize: '12px', fontWeight: 600, color: '#6b7280',
            marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Săptămâna {wi + 1} — {format(parseISO(weekDates[0]), 'd MMM')} –{' '}
            {format(parseISO(weekDates[weekDates.length - 1]), 'd MMM yyyy')}
          </div>

          {/* Table */}
          <div style={{ borderRadius: '10px', border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    width: '130px', padding: '7px 10px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 500, color: '#9ca3af',
                    background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                  }}>Tură</th>
                  {weekDates.map((date) => {
                    const holiday = holidayMap[date]
                    const dow = parseISO(date).getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <th key={date} style={{
                        padding: '7px 5px', textAlign: 'center', minWidth: '80px',
                        background: holiday ? '#fffbeb' : isWeekend ? '#fafafa' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb', borderLeft: '0.5px solid #f0f0f0',
                      }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>{DAY_NAMES[dow]}</div>
                        <div style={{
                          fontSize: '13px', fontWeight: 600,
                          color: holiday ? '#b45309' : isWeekend ? '#9ca3af' : '#111827',
                        }}>
                          {format(parseISO(date), 'd MMM')}
                        </div>
                        {holiday && (
                          <div style={{ fontSize: '9px', color: '#d97706', lineHeight: 1.2 }}>
                            {holiday.localName}
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {shiftDefinitions.map((shift, idx) => {
                  const s = SHIFT_STYLES[idx % SHIFT_STYLES.length]
                  const isLast = idx === shiftDefinitions.length - 1
                  return (
                    <tr key={shift.id}>
                      <td style={{
                        padding: '8px 10px',
                        borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                        borderRight: '1px solid #e5e7eb',
                        verticalAlign: 'middle',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: '4px', height: '36px', borderRadius: '2px',
                            background: s.border, flexShrink: 0,
                          }} />
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>
                              {shift.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#6b7280' }}>
                              {(shift as any).start_time} – {(shift as any).end_time}
                            </div>
                          </div>
                        </div>
                      </td>
                      {weekDates.map((date) => {
                        const off = isOff(date)
                        const names = shiftDateMap[shift.id]?.[date] ?? []
                        return (
                          <td key={date} style={{
                            padding: '4px',
                            borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                            borderLeft: '0.5px solid #f0f0f0',
                            background: holidayMap[date] ? '#fffbeb' : off ? '#fafafa' : '#fff',
                            verticalAlign: 'top', minWidth: '80px',
                          }}>
                            {off ? (
                              <div style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#e5e7eb' }}>✕</span>
                              </div>
                            ) : names.length === 0 ? (
                              <div style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '10px', color: '#d1d5db' }}>—</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {names.map((name) => (
                                  <div key={name} style={{
                                    padding: '3px 6px', borderRadius: '3px',
                                    borderLeft: `${s.borderW}px solid ${s.border}`,
                                    background: s.bg, color: s.text,
                                    fontSize: '10px', fontWeight: 500,
                                  }}>
                                    {name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
        {shiftDefinitions.map((shift, idx) => {
          const s = SHIFT_STYLES[idx % SHIFT_STYLES.length]
          return (
            <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '20px', height: '12px', borderRadius: '3px',
                background: s.bg, borderLeft: `${s.borderW}px solid ${s.border}`,
              }} />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                {shift.name} ({(shift as any).start_time}–{(shift as any).end_time})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}