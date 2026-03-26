'use client'

import { useState, useMemo } from 'react'
import { format, addDays, parseISO, eachDayOfInterval } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Schedule, Employee, ShiftAssignment, ShiftDefinition } from '@/types'
import type { PublicHoliday } from '@/lib/holidays'

interface ScheduleGridProps {
  schedule: Schedule
  assignments: (ShiftAssignment & {
    employees: { name: string; color: string }
    shift_definitions: { name: string; color: string; start_time: string; end_time: string }
  })[]
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  holidays: PublicHoliday[]
}

const WEEK_SIZE = 7

export function ScheduleGrid({
  schedule,
  assignments,
  employees,
  shiftDefinitions,
  holidays,
}: ScheduleGridProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  // Build list of all dates in the schedule
  const allDates = useMemo(() => {
    return eachDayOfInterval({
      start: parseISO(schedule.start_date),
      end: parseISO(schedule.end_date),
    }).map((d) => format(d, 'yyyy-MM-dd'))
  }, [schedule])

  // Paginate by week
  const visibleDates = allDates.slice(weekOffset * WEEK_SIZE, (weekOffset + 1) * WEEK_SIZE)
  const totalWeeks = Math.ceil(allDates.length / WEEK_SIZE)

  // Build lookup: date -> employeeId -> assignment[]
  const assignmentMap = useMemo(() => {
    const map: Record<string, Record<string, typeof assignments>> = {}
    for (const a of assignments) {
      if (!map[a.date]) map[a.date] = {}
      if (!map[a.date][a.employee_id]) map[a.date][a.employee_id] = []
      map[a.date][a.employee_id].push(a)
    }
    return map
  }, [assignments])

  const holidayMap = useMemo(() => {
    const map: Record<string, PublicHoliday> = {}
    holidays.forEach((h) => (map[h.date] = h))
    return map
  }, [holidays])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Previous
        </button>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Week {weekOffset + 1} of {totalWeeks}
          {visibleDates[0] && (
            <span className="text-gray-400 font-normal ml-2">
              {format(parseISO(visibleDates[0]), 'd MMM')} –{' '}
              {format(parseISO(visibleDates[visibleDates.length - 1] ?? visibleDates[0]), 'd MMM yyyy')}
            </span>
          )}
        </span>
        <button
          onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
          disabled={weekOffset >= totalWeeks - 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {/* Employee column */}
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs w-36 sticky left-0 bg-white dark:bg-gray-900 z-10">
                Employee
              </th>
              {visibleDates.map((date) => {
                const holiday = holidayMap[date]
                const isWorking = schedule.working_days.includes(
                  parseISO(date).getDay() === 0 ? 7 : parseISO(date).getDay()
                )
                return (
                  <th
                    key={date}
                    className={cn(
                      'text-center px-2 py-3 font-medium text-xs min-w-[90px]',
                      !isWorking && 'bg-gray-50 dark:bg-gray-800/50',
                      holiday && 'bg-amber-50 dark:bg-amber-950/20'
                    )}
                  >
                    <div className="text-gray-400">{format(parseISO(date), 'EEE')}</div>
                    <div className={cn('font-semibold', holiday ? 'text-amber-600' : 'text-gray-700 dark:text-gray-300')}>
                      {format(parseISO(date), 'd MMM')}
                    </div>
                    {holiday && (
                      <div className="text-amber-500 text-[10px] truncate max-w-[80px] mx-auto" title={holiday.localName}>
                        {holiday.localName}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, idx) => (
              <tr
                key={employee.id}
                className={cn(
                  'border-b border-gray-50 dark:border-gray-800/50 last:border-0',
                  idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/10'
                )}
              >
                {/* Employee name */}
                <td className="px-4 py-2 sticky left-0 bg-white dark:bg-gray-900 z-10">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: employee.color ?? '#6366f1' }}
                    />
                    <div>
                      <p className="font-medium text-xs">{employee.name}</p>
                      <p className="text-gray-400 text-[10px] capitalize">{employee.experience_level}</p>
                    </div>
                  </div>
                </td>

                {/* Cells per date */}
                {visibleDates.map((date) => {
                  const dayAssignments = assignmentMap[date]?.[employee.id] ?? []
                  const isWorking = schedule.working_days.includes(
                    parseISO(date).getDay() === 0 ? 7 : parseISO(date).getDay()
                  )
                  const holiday = holidayMap[date]

                  return (
                    <td
                      key={date}
                      className={cn(
                        'px-2 py-1.5 text-center',
                        !isWorking && 'bg-gray-50 dark:bg-gray-800/50',
                        holiday && 'bg-amber-50/50 dark:bg-amber-950/10'
                      )}
                    >
                      {dayAssignments.length === 0 ? (
                        <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {dayAssignments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium text-white truncate max-w-[80px]"
                              style={{ background: a.shift_definitions?.color ?? '#6366f1' }}
                              title={`${a.shift_definitions?.name} ${a.shift_definitions?.start_time}–${a.shift_definitions?.end_time}${a.role_in_shift ? ` · ${a.role_in_shift}` : ''}`}
                            >
                              {a.shift_definitions?.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {shiftDefinitions.length > 0 && (
        <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          {shiftDefinitions.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {s.name} ({s.start_time}–{s.end_time})
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-3 h-3 rounded-sm bg-amber-200" />
            Public holiday
          </div>
        </div>
      )}
    </div>
  )
}
