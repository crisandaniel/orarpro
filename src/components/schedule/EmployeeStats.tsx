'use client'

// Employee statistics panel — shown after schedule generation.
// Displays per-employee: total hours, hours per week, hours per shift type,
// and consecutive days per shift.
// Used by: schedules/[id]/page.tsx.

import { useMemo, useState } from 'react'
import { parseISO, format, startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Employee, ShiftDefinition, ShiftAssignment } from '@/types'

interface Props {
  employees: Employee[]
  assignments: (ShiftAssignment & {
    employees: { name: string; color: string }
    shift_definitions: { name: string; start_time: string; end_time: string; shift_type: string }
  })[]
  shiftDefinitions: ShiftDefinition[]
  schedule: { start_date: string; end_date: string }
}

function shiftHours(sd: { start_time: string; end_time: string }) {
  const [sh, sm] = sd.start_time.split(':').map(Number)
  const [eh, em] = sd.end_time.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // crosses midnight
  return mins / 60
}

function maxConsecutive(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = [...dates].sort()
  let max = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1])
    const curr = parseISO(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    cur = diff === 1 ? cur + 1 : 1
    if (cur > max) max = cur
  }
  return max
}

export function EmployeeStats({ employees, assignments, shiftDefinitions, schedule }: Props) {
  const [open, setOpen] = useState(false)
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null)

  const weeks = useMemo(() => {
    const start = parseISO(schedule.start_date)
    const end   = parseISO(schedule.end_date)
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
  }, [schedule])

  const stats = useMemo(() => {
    return employees.map(emp => {
      const empAssignments = assignments.filter(a => a.employee_id === emp.id)

      // Total hours
      const totalHours = empAssignments.reduce((sum, a) => {
        const sd = a.shift_definitions
        return sum + (sd ? shiftHours(sd) : 0)
      }, 0)

      // Hours per week
      const hoursPerWeek = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        const weekAssignments = empAssignments.filter(a =>
          isSameWeek(parseISO(a.date), weekStart, { weekStartsOn: 1 })
        )
        const hours = weekAssignments.reduce((sum, a) => {
          return sum + (a.shift_definitions ? shiftHours(a.shift_definitions) : 0)
        }, 0)
        return {
          label: `${format(weekStart, 'd MMM')}–${format(weekEnd, 'd MMM')}`,
          hours,
          days: weekAssignments.length,
        }
      })

      // Hours per shift type
      const hoursPerShift: Record<string, number> = {}
      const datesPerShift: Record<string, string[]> = {}
      for (const a of empAssignments) {
        const sd = a.shift_definitions
        if (!sd) continue
        const name = sd.name
        hoursPerShift[name] = (hoursPerShift[name] ?? 0) + shiftHours(sd)
        if (!datesPerShift[name]) datesPerShift[name] = []
        datesPerShift[name].push(a.date)
      }

      // Max consecutive days per shift
      const consecutivePerShift: Record<string, number> = {}
      for (const [name, dates] of Object.entries(datesPerShift)) {
        consecutivePerShift[name] = maxConsecutive(dates)
      }

      // Overall max consecutive working days
      const allDates = empAssignments.map(a => a.date)
      const maxConsecTotal = maxConsecutive(allDates)

      return {
        emp, totalHours, hoursPerWeek,
        hoursPerShift, consecutivePerShift, maxConsecTotal,
        totalDays: empAssignments.length,
      }
    })
  }, [employees, assignments, weeks])

  const totalWeeks = weeks.length

  if (assignments.length === 0) return null

  return (
    <div className="bg-white rounded-xl mt-4 print-hide" style={{ border: '0.5px solid #e5e7eb' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer"
        style={{ borderBottom: open ? '0.5px solid #f3f4f6' : 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#111827' }}>
            Statistici angajați
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#166534' }}>
            {employees.length} angajați · {assignments.length} asignări
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: '#9ca3af' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: '#9ca3af' }} />}
      </div>

      {open && (
        <div>
          {/* Summary table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', position: 'sticky', left: 0, background: '#f9fafb', minWidth: '140px' }}>
                    Angajat
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    Total ore
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    Total zile
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    Max consecutive
                  </th>
                  {shiftDefinitions.map(sd => (
                    <th key={sd.id} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {sd.name}
                    </th>
                  ))}
                  {weeks.map((w, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      Săpt {i + 1}
                    </th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9ca3af' }} />
                </tr>
              </thead>
              <tbody>
                {stats.map((s, idx) => {
                  const isExpanded = expandedEmp === s.emp.id
                  const isLast = idx === stats.length - 1
                  return (
                    <>
                      <tr key={s.emp.id}
                        style={{ borderBottom: isExpanded || !isLast ? '0.5px solid #f3f4f6' : 'none', cursor: 'pointer' }}
                        className="hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedEmp(isExpanded ? null : s.emp.id)}
                      >
                        {/* Name */}
                        <td style={{ padding: '10px 16px', position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.emp.color || '#6366f1', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>{s.emp.name}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px', marginLeft: '16px' }}>
                            {s.emp.experience_level}
                          </div>
                        </td>

                        {/* Total hours */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                            {s.totalHours.toFixed(0)}h
                          </span>
                        </td>

                        {/* Total days */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.totalDays}</span>
                        </td>

                        {/* Max consecutive */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: 500,
                            color: s.maxConsecTotal > 6 ? '#dc2626' : s.maxConsecTotal > 4 ? '#d97706' : '#059669',
                          }}>
                            {s.maxConsecTotal} zile
                          </span>
                        </td>

                        {/* Hours per shift */}
                        {shiftDefinitions.map(sd => (
                          <td key={sd.id} style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#374151' }}>
                              {(s.hoursPerShift[sd.name] ?? 0).toFixed(0)}h
                            </div>
                            {s.consecutivePerShift[sd.name] != null && (
                              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>
                                max {s.consecutivePerShift[sd.name]}z
                              </div>
                            )}
                          </td>
                        ))}

                        {/* Hours per week */}
                        {s.hoursPerWeek.map((w, i) => (
                          <td key={i} style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: w.hours > 48 ? '#dc2626' : '#374151', fontWeight: w.hours > 40 ? 500 : 400 }}>
                              {w.hours.toFixed(0)}h
                            </div>
                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>{w.days}z</div>
                          </td>
                        ))}

                        {/* Expand */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 mx-auto" style={{ color: '#9ca3af' }} />
                            : <ChevronDown className="w-3.5 h-3.5 mx-auto" style={{ color: '#9ca3af' }} />}
                        </td>
                      </tr>

                      {/* Expanded weekly detail */}
                      {isExpanded && (
                        <tr key={`${s.emp.id}-detail`} style={{ borderBottom: isLast ? 'none' : '0.5px solid #f3f4f6' }}>
                          <td colSpan={4 + shiftDefinitions.length + weeks.length + 1}
                            style={{ padding: '8px 16px 12px 32px', background: '#fafafa' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>
                              Distribuție săptămânală
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {s.hoursPerWeek.map((w, i) => (
                                <div key={i} style={{
                                  padding: '6px 10px', borderRadius: '8px',
                                  background: w.hours === 0 ? '#f9fafb' : w.hours > 48 ? '#fef2f2' : '#f0fdf4',
                                  border: `0.5px solid ${w.hours === 0 ? '#e5e7eb' : w.hours > 48 ? '#fecaca' : '#bbf7d0'}`,
                                  minWidth: '80px',
                                }}>
                                  <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
                                    Săpt {i + 1} · {w.label}
                                  </div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: w.hours > 48 ? '#dc2626' : '#111827' }}>
                                    {w.hours.toFixed(0)}h
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#6b7280' }}>{w.days} zile</div>
                                </div>
                              ))}
                            </div>
                            {/* Shift breakdown */}
                            {Object.keys(s.hoursPerShift).length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>
                                  Distribuție pe ture
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {Object.entries(s.hoursPerShift).map(([name, hours]) => (
                                    <div key={name} style={{
                                      padding: '6px 10px', borderRadius: '8px',
                                      background: '#eff6ff', border: '0.5px solid #bfdbfe',
                                      minWidth: '80px',
                                    }}>
                                      <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>{name}</div>
                                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d4ed8' }}>{hours.toFixed(0)}h</div>
                                      <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                        max {s.consecutivePerShift[name] ?? 0} zile consecutive
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>

              {/* Summary row */}
              <tfoot>
                <tr style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: '#374151', position: 'sticky', left: 0, background: '#f9fafb' }}>
                    Total
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                    {stats.reduce((s, e) => s + e.totalHours, 0).toFixed(0)}h
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                    {stats.reduce((s, e) => s + e.totalDays, 0)}
                  </td>
                  <td />
                  {shiftDefinitions.map(sd => (
                    <td key={sd.id} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#374151' }}>
                      {stats.reduce((s, e) => s + (e.hoursPerShift[sd.name] ?? 0), 0).toFixed(0)}h
                    </td>
                  ))}
                  {weeks.map((_, i) => (
                    <td key={i} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#374151' }}>
                      {stats.reduce((s, e) => s + (e.hoursPerWeek[i]?.hours ?? 0), 0).toFixed(0)}h
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
