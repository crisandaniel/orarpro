'use client'

// Weekly schedule grid with two view modes:
//   'shifts'    — ture pe stânga, zile pe sus, celule = lista angajaților asignați
//   'employees' — angajați pe stânga, zile pe sus, celule = tura asignată
// B&W print safe: border-left thickness varies per shift (3–7px) + text names always visible.
// Used by: schedules/[id]/page.tsx.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
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
  scheduleId: string
  onAssignmentsChange?: (assignments: any[]) => void
}

const WEEK_SIZE = 7

// Shift styles — differentiable in B&W via border-left thickness (3→7px)
const SHIFT_STYLES = [
  { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e', borderW: 3 },
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d', borderW: 4 },
  { bg: '#fef3c7', border: '#d97706', text: '#78350f', borderW: 5 },
  { bg: '#fce7f3', border: '#db2777', text: '#831843', borderW: 6 },
  { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95', borderW: 7 },
  { bg: '#fff7ed', border: '#ea580c', text: '#7c2d12', borderW: 3 },
  { bg: '#f0fdf4', border: '#15803d', text: '#14532d', borderW: 4 },
  { bg: '#fdf4ff', border: '#a21caf', text: '#701a75', borderW: 5 },
]

// Build a map of shiftId → style index so the same shift always gets the same style
function buildShiftStyleMap(shiftDefs: ShiftDefinition[]) {
  const map: Record<string, number> = {}
  shiftDefs.forEach((s, i) => { map[s.id] = i % SHIFT_STYLES.length })
  return map
}

const DAY_NAMES = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

// ── Shared sub-components ────────────────────────────────────────────────────

// Day header cell — used in both view modes
function DayHeader({ date, holiday }: { date: string; holiday?: PublicHoliday }) {
  const dow = parseISO(date).getDay()
  const isWeekend = dow === 0 || dow === 6
  return (
    <th style={{
      padding: '8px 6px', textAlign: 'center', minWidth: '90px',
      background: holiday ? '#fffbeb' : isWeekend ? '#fafafa' : '#f9fafb',
      borderBottom: '1px solid #e5e7eb', borderLeft: '0.5px solid #f0f0f0',
    }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>
        {DAY_NAMES[dow]}
      </div>
      <div style={{
        fontSize: '13px', fontWeight: 600, marginTop: '2px',
        color: holiday ? '#b45309' : isWeekend ? '#9ca3af' : '#111827',
      }}>
        {format(parseISO(date), 'd MMM')}
      </div>
      {holiday && (
        <div style={{ fontSize: '9px', color: '#d97706', marginTop: '1px', lineHeight: 1.2 }}>
          {holiday.localName}
        </div>
      )}
    </th>
  )
}

// Name badge — used in both views
function NameBadge({ label, styleIdx }: { label: string; styleIdx: number }) {
  const s = SHIFT_STYLES[styleIdx]
  return (
    <div style={{
      padding: '3px 7px', borderRadius: '4px',
      borderLeft: `${s.borderW}px solid ${s.border}`,
      background: s.bg, color: s.text,
      fontSize: '11px', fontWeight: 500, lineHeight: 1.3,
    }}>
      {label}
    </div>
  )
}


// ── Main component ────────────────────────────────────────────────────────────

export function ScheduleGrid({
  schedule, assignments, employees, shiftDefinitions, holidays, scheduleId, onAssignmentsChange,
}: ScheduleGridProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'shifts' | 'employees'>('shifts')
  // Editing state: which cell is open for manual edit
  const [editCell, setEditCell] = useState<{ shiftId: string; date: string } | null>(null)
  // Dropdown portal position — tracks the clicked cell's screen position
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [saving, setSaving] = useState(false)
  // Local assignments state so edits reflect immediately without page reload
  const [localAssignments, setLocalAssignments] = useState(assignments)

  const allDates = useMemo(() =>
    eachDayOfInterval({
      start: parseISO(schedule.start_date),
      end: parseISO(schedule.end_date),
    }).map((d) => format(d, 'yyyy-MM-dd'))
  , [schedule])

  const visibleDates = allDates.slice(weekOffset * WEEK_SIZE, (weekOffset + 1) * WEEK_SIZE)
  const totalWeeks = Math.ceil(allDates.length / WEEK_SIZE)

  const holidayMap = useMemo(() => {
    const m: Record<string, PublicHoliday> = {}
    holidays.forEach((h) => (m[h.date] = h))
    return m
  }, [holidays])

  const shiftStyleMap = useMemo(() => buildShiftStyleMap(shiftDefinitions), [shiftDefinitions])

  // assignmentMap[shiftId][date] = string[] of employee names
  // Both maps use localAssignments so manual edits reflect immediately
  const byShift = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {}
    for (const a of localAssignments) {
      const sid = a.shift_definition_id
      const name = (a as any).employees?.name ?? '?'
      if (!map[sid]) map[sid] = {}
      if (!map[sid][a.date]) map[sid][a.date] = []
      map[sid][a.date].push(name)
    }
    return map
  }, [localAssignments])

  const byEmployee = useMemo(() => {
    const map: Record<string, Record<string, { shiftId: string; shiftName: string }[]>> = {}
    for (const a of localAssignments) {
      const eid = a.employee_id
      const sd = (a as any).shift_definitions
      if (!map[eid]) map[eid] = {}
      if (!map[eid][a.date]) map[eid][a.date] = []
      map[eid][a.date].push({ shiftId: a.shift_definition_id, shiftName: sd?.name ?? '?' })
    }
    return map
  }, [localAssignments])

  // Shared nav header
  const Nav = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', borderBottom: '0.5px solid #f3f4f6',
    }}>
      <button className="print-hide" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
        disabled={weekOffset === 0}
        style={{
          padding: '5px 12px', fontSize: '13px', borderRadius: '8px',
          border: '0.5px solid #e5e7eb', background: '#fff', color: '#374151',
          cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
          opacity: weekOffset === 0 ? 0.4 : 1,
        }}>← Precedenta</button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
          Săptămâna {weekOffset + 1} din {totalWeeks}
        </div>
        {visibleDates[0] && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {format(parseISO(visibleDates[0]), 'd MMM')} –{' '}
            {format(parseISO(visibleDates[visibleDates.length - 1] ?? visibleDates[0]), 'd MMM yyyy')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Print button — generates full HTML in new tab */}
        <button
          onClick={printAllWeeks}
          className="print-hide"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', fontSize: '12px', borderRadius: '8px',
            border: '0.5px solid #e5e7eb', background: '#fff', color: '#374151',
            cursor: 'pointer',
          }}
        >
          🖨 Print / PDF
        </button>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid #e5e7eb' }}>
          {(['shifts', 'employees'] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '4px 10px', fontSize: '12px', fontWeight: 500,
              border: 'none', cursor: 'pointer',
              background: viewMode === mode ? '#2563eb' : '#fff',
              color: viewMode === mode ? '#fff' : '#6b7280',
            }}>
              {mode === 'shifts' ? 'Ture' : 'Angajați'}
            </button>
          ))}
        </div>

        <button onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
          disabled={weekOffset >= totalWeeks - 1}
          style={{
            padding: '5px 12px', fontSize: '13px', borderRadius: '8px',
            border: '0.5px solid #e5e7eb', background: '#fff', color: '#374151',
            cursor: weekOffset >= totalWeeks - 1 ? 'not-allowed' : 'pointer',
            opacity: weekOffset >= totalWeeks - 1 ? 0.4 : 1,
          }}>Următoarea →</button>
      </div>
    </div>
  )

  // Legend
  const Legend = shiftDefinitions.length > 0 ? (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px',
      padding: '10px 16px', borderTop: '0.5px solid #f3f4f6',
    }}>
      {shiftDefinitions.map((shift) => {
        const s = SHIFT_STYLES[shiftStyleMap[shift.id]]
        return (
          <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '20px', height: '12px', borderRadius: '3px',
              background: s.bg, borderLeft: `${s.borderW}px solid ${s.border}`, flexShrink: 0,
            }} />
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              {shift.name}
              {(shift as any).start_time && (
                <span style={{ color: '#9ca3af' }}>
                  {' '}({(shift as any).start_time}–{(shift as any).end_time})
                </span>
              )}
            </span>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '20px', height: '12px', borderRadius: '3px', background: '#fffbeb', border: '1px solid #fcd34d' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Sărbătoare</span>
      </div>
    </div>
  ) : null


  // ── Print: generates HTML in new window with all weeks ──────────────────────
  function printAllWeeks() {
    const DAY_N = ['Dum','Lun','Mar','Mie','Joi','Vin','Sâm']
    const weeks: string[][] = []
    for (let i = 0; i < allDates.length; i += 7) weeks.push(allDates.slice(i, i + 7))

    const cellBg = (date: string) => {
      const h = holidayMap[date]
      const dow = parseISO(date).getDay()
      const off = !schedule.working_days?.includes(dow === 0 ? 7 : dow)
      return h ? '#fffbeb' : off ? '#fafafa' : '#fff'
    }
    const isDateOff = (date: string) => {
      const dow = parseISO(date).getDay()
      return !schedule.working_days?.includes(dow === 0 ? 7 : dow)
    }

    const shiftRowsHtml = (weekDates: string[]) => shiftDefinitions.map((shift, idx) => {
      const s = SHIFT_STYLES[idx % SHIFT_STYLES.length]
      const cells = weekDates.map(date => {
        const names = byShift[shift.id]?.[date] ?? []
        const off = isDateOff(date)
        const bg = cellBg(date)
        if (off) return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;text-align:center;font-size:12px;color:#e5e7eb">✕</td>`
        if (!names.length) return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;text-align:center;color:#d1d5db;font-size:10px">—</td>`
        return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;vertical-align:top">${
          names.map(n => `<div style="padding:2px 5px;border-radius:3px;border-left:${s.borderW}px solid ${s.border};background:${s.bg};color:${s.text};font-size:10px;font-weight:500;margin-bottom:2px">${n}</div>`).join('')
        }</td>`
      }).join('')
      return `<tr>
        <td style="padding:8px 10px;border-right:1px solid #e5e7eb;border-bottom:0.5px solid #f0f0f0;white-space:nowrap">
          <div style="display:flex;gap:6px;align-items:center">
            <div style="width:3px;height:32px;border-radius:2px;background:${s.border};flex-shrink:0"></div>
            <div><div style="font-size:11px;font-weight:600;color:#111827">${shift.name}</div>
            <div style="font-size:10px;color:#6b7280">${(shift as any).start_time}–${(shift as any).end_time}</div></div>
          </div>
        </td>${cells}</tr>`
    }).join('')

    const empRowsHtml = (weekDates: string[]) => employees.map(emp => {
      const cells = weekDates.map(date => {
        const entries = byEmployee[emp.id]?.[date] ?? []
        const off = isDateOff(date)
        const bg = cellBg(date)
        if (off) return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;text-align:center;font-size:12px;color:#e5e7eb">✕</td>`
        if (!entries.length) return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;text-align:center;color:#d1d5db;font-size:10px">—</td>`
        return `<td style="background:${bg};padding:4px;border-left:0.5px solid #f0f0f0;vertical-align:top">${
          entries.map(({ shiftId, shiftName }: any) => {
            const si = shiftStyleMap[shiftId] ?? 0
            const s = SHIFT_STYLES[si % SHIFT_STYLES.length]
            return `<div style="padding:2px 5px;border-radius:3px;border-left:${s.borderW}px solid ${s.border};background:${s.bg};color:${s.text};font-size:10px;font-weight:500;margin-bottom:2px">${shiftName}</div>`
          }).join('')
        }</td>`
      }).join('')
      return `<tr>
        <td style="padding:8px 10px;border-right:1px solid #e5e7eb;border-bottom:0.5px solid #f0f0f0;white-space:nowrap">
          <div style="font-size:11px;font-weight:600;color:#111827">${emp.name}</div>
          <div style="font-size:10px;color:#6b7280">${emp.experience_level}</div>
        </td>${cells}</tr>`
    }).join('')

    const tableHtml = (weekDates: string[], wi: number) => {
      const ths = weekDates.map(date => {
        const h = holidayMap[date]
        const dow = parseISO(date).getDay()
        const bg = h ? '#fffbeb' : (dow===0||dow===6) ? '#fafafa' : '#f9fafb'
        const col = h ? '#b45309' : (dow===0||dow===6) ? '#9ca3af' : '#111827'
        return `<th style="padding:6px 4px;text-align:center;min-width:75px;background:${bg};border-bottom:1px solid #e5e7eb;border-left:0.5px solid #f0f0f0">
          <div style="font-size:10px;color:#9ca3af">${DAY_N[dow]}</div>
          <div style="font-size:13px;font-weight:600;color:${col}">${format(parseISO(date),'d MMM')}</div>
          ${h ? `<div style="font-size:8px;color:#d97706">${h.localName}</div>` : ''}
        </th>`
      }).join('')
      const rows = viewMode === 'shifts' ? shiftRowsHtml(weekDates) : empRowsHtml(weekDates)
      const wStart = weekDates[0] ? format(parseISO(weekDates[0]), 'd MMM') : ''
      const wEnd = weekDates[weekDates.length-1] ? format(parseISO(weekDates[weekDates.length-1]), 'd MMM yyyy') : ''
      return `
        <div style="margin-bottom:20px;page-break-inside:avoid">
          <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">
            Săptămâna ${wi+1} — ${wStart} – ${wEnd}
          </div>
          <div style="border:0.5px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr>
                <th style="width:130px;padding:6px 10px;text-align:left;font-size:10px;color:#9ca3af;background:#f9fafb;border-bottom:1px solid #e5e7eb">${viewMode==='shifts'?'Tură':'Angajat'}</th>
                ${ths}
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`
    }

    const dStart = allDates[0] ? format(parseISO(allDates[0]),'d MMM yyyy') : ''
    const dEnd = allDates[allDates.length-1] ? format(parseISO(allDates[allDates.length-1]),'d MMM yyyy') : ''

    const html = `<!DOCTYPE html><html lang="ro"><head>
      <meta charset="utf-8">
      <title>${schedule.name}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        body{background:#f8f9fc;padding:24px}
        .toolbar{display:flex;align-items:center;justify-content:space-between;background:white;border:0.5px solid #e5e7eb;border-radius:12px;padding:14px 20px;margin-bottom:20px}
        .btn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;background:#2563eb;color:white;font-size:13px;font-weight:500}
        @media print{.toolbar{display:none!important}body{background:white;padding:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}@page{margin:8mm;size:landscape}}
      </style>
    </head><body>
      <div class="toolbar">
        <div>
          <div style="font-size:18px;font-weight:700;color:#111827">${schedule.name}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:2px">${dStart} – ${dEnd} · ${employees.length} angajați</div>
        </div>
        <button class="btn" onclick="window.print()">⬇ Descarcă PDF</button>
      </div>
      ${weeks.map((wd, wi) => tableHtml(wd, wi)).join('')}
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // isOff: true if date is not a working day for this schedule
  const isOff = (date: string) => {
    const dow = parseISO(date).getDay()
    return !schedule.working_days?.includes(dow === 0 ? 7 : dow)
  }

  async function addAssignment(shiftId: string, date: string, employee: Employee) {
    setSaving(true)
    const res = await fetch(`/api/schedules/${scheduleId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, shiftDefinitionId: shiftId, date }),
    })
    if (res.ok) {
      const { assignment } = await res.json()
      setLocalAssignments(prev => {
        const next = [...prev, assignment]
        onAssignmentsChange?.(next)
        return next
      })
    }
    setSaving(false)
    setEditCell(null)
  }

  async function removeAssignment(shiftId: string, date: string, employeeId: string) {
    setSaving(true)
    await fetch(`/api/schedules/${scheduleId}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, shiftDefinitionId: shiftId, date }),
    })
    setLocalAssignments(prev => {
      const next = prev.filter(a =>
        !(a.shift_definition_id === shiftId && a.date === date && a.employee_id === employeeId)
      )
      onAssignmentsChange?.(next)
      return next
    })
    setSaving(false)
  }

  // ── Compute uncovered cells (working day, no assignments) ─────────────────
  const violations = useMemo(() => {
    const list: { shiftName: string; date: string; label: string }[] = []
    const DAY = ['Dum','Lun','Mar','Mie','Joi','Vin','Sâm']
    for (const shift of shiftDefinitions) {
      for (const date of allDates) {
        const dow = parseISO(date).getDay()
        // Skip non-working days (weekends, days not in schedule.working_days)
        const isWorkingDay = schedule.working_days?.includes(dow === 0 ? 7 : dow)
        if (!isWorkingDay) continue
        // Skip holidays when include_holidays = false (they are days off, never a violation)
        // When include_holidays = true, treat holidays as normal working days
        const isHolidayDate = !!holidayMap[date]
        if (isHolidayDate && !schedule.include_holidays) continue
        // If working_days doesn't include this dow, it's not a working day
        // (already checked above via isWorkingDay)
        // Check if at least one employee is assigned
        const count = localAssignments.filter(
          a => a.shift_definition_id === shift.id && a.date === date
        ).length
        if (count === 0) {
          const isHoliday = !!holidayMap[date]
          list.push({
            shiftName: shift.name,
            date,
            label: `${shift.name} — ${DAY[dow]} ${format(parseISO(date), 'd MMM')}${isHoliday ? ' 🎉' : ''}`,
          })
        }
      }
    }
    return list
  }, [shiftDefinitions, allDates, localAssignments, schedule, holidayMap])

  const wrapper = { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' }
  const wrapperClass = 'print-target'

  // ── View: Shifts as rows ────────────────────────────────────────────────────
  if (viewMode === 'shifts') {
    return (
      <div style={wrapper} className={wrapperClass}>
        {Nav}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{
                  width: '150px', padding: '8px 12px', textAlign: 'left',
                  fontSize: '11px', fontWeight: 500, color: '#9ca3af',
                  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                  position: 'sticky', left: 0, zIndex: 10,
                }}>Tură</th>
                {visibleDates.map((date) => (
                  <DayHeader key={date} date={date} holiday={holidayMap[date]} />
                ))}
              </tr>
            </thead>
            <tbody>
              {shiftDefinitions.length === 0 ? (
                <tr>
                  <td colSpan={visibleDates.length + 1}
                    style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                    Nicio tură definită. Completează pasul 2 din wizard.
                  </td>
                </tr>
              ) : shiftDefinitions.map((shift, idx) => {
                const s = SHIFT_STYLES[shiftStyleMap[shift.id]]
                const isLast = idx === shiftDefinitions.length - 1
                return (
                  <tr key={shift.id}>
                    {/* Shift label */}
                    <td style={{
                      padding: '10px 12px', borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                      borderRight: '1px solid #e5e7eb', background: '#fff',
                      position: 'sticky', left: 0, zIndex: 5, verticalAlign: 'middle',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ width: '4px', minHeight: '36px', borderRadius: '2px', background: s.border, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{shift.name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                            {(shift as any).start_time} – {(shift as any).end_time}
                          </div>
                          {(shift as any).shift_type === 'night' && (
                            <span style={{
                              display: 'inline-block', fontSize: '9px', marginTop: '2px',
                              padding: '1px 5px', borderRadius: '3px', background: '#1e293b', color: '#e2e8f0',
                            }}>NOAPTE</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Day cells */}
                    {visibleDates.map((date) => {
                      const holiday = holidayMap[date]
                      const dow = parseISO(date).getDay()
                      const isWorking = schedule.working_days?.includes(dow === 0 ? 7 : dow)
                      const names = byShift[shift.id]?.[date] ?? []
                      const isEditing = editCell?.shiftId === shift.id && editCell?.date === date
                      // Employees already in this cell
                      const assignedIds = new Set(
                        localAssignments
                          .filter(a => a.shift_definition_id === shift.id && a.date === date)
                          .map(a => a.employee_id)
                      )
                      return (
                        <td key={date}
                          onClick={(e) => {
                        if (!isWorking) return
                        if (isEditing) {
                          setEditCell(null)
                          setDropdownPos(null)
                        } else {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          })
                          setEditCell({ shiftId: shift.id, date })
                        }
                      }}
                          style={{
                            padding: '5px', verticalAlign: 'top', minWidth: '90px',
                            borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                            borderLeft: '0.5px solid #f0f0f0',
                            background: isEditing ? '#f0f9ff' : holiday ? '#fffbeb' : !isWorking ? '#fafafa' : '#fff',
                            cursor: isWorking ? 'pointer' : 'default',
                            position: 'relative',
                          }}>
                          {!isWorking ? (
                            <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '14px', color: '#e5e7eb' }}>✕</span>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minHeight: '36px' }}>
                                {names.map((name) => {
                                  const a = localAssignments.find(a =>
                                    a.shift_definition_id === shift.id && a.date === date &&
                                    (a as any).employees?.name === name
                                  )
                                  return (
                                    <div key={name} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <NameBadge label={name} styleIdx={shiftStyleMap[shift.id] ?? 0} />
                                      {isEditing && a && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeAssignment(shift.id, date, a.employee_id) }}
                                          style={{ background: '#ef4444', border: 'none', borderRadius: '50%',
                                            width: '14px', height: '14px', color: 'white', cursor: 'pointer',
                                            fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0 }}>✕</button>
                                      )}
                                    </div>
                                  )
                                })}
                                {names.length === 0 && (
                                  <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    {isEditing ? (
                                      <span style={{ fontSize: '11px', color: '#93c5fd' }}>+ adaugă</span>
                                    ) : (
                                      <>
                                        {/* ⚠ uncovered badge — visible on screen, hidden at print */}
                                        <span className="print-hide" title="Tură neacoperită" style={{
                                          fontSize: '13px', color: '#f97316',
                                        }}>⚠</span>
                                        {/* ✏ edit hint on hover */}
                                        <span className="edit-hint print-hide" style={{
                                          position: 'absolute', top: '2px', right: '2px',
                                          fontSize: '9px', color: '#9ca3af', opacity: 0,
                                          transition: 'opacity 0.15s',
                                        }}>✏</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Dropdown rendered via portal — see bottom of component */}
                            </>
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
        {Legend}
      {/* ── Violations panel — uncovered shifts ─────────────────────────────── */}
      {violations.length > 0 && (
        <div className="print-hide" style={{
          borderTop: '0.5px solid #fee2e2',
          background: '#fff7f7',
          padding: '10px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px' }}>⚠️</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
              {violations.length} {violations.length === 1 ? 'tură neacoperită' : 'ture neacoperite'}
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>— click pe celulă pentru a adăuga angajați</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {violations.map((v, i) => (
              <span key={i} style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                background: '#fee2e2', color: '#dc2626',
                border: '0.5px solid #fecaca',
              }}>
                {v.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* ── Employee picker portal ── */}
      {mounted && editCell && dropdownPos && (() => {
        const assignedIds = new Set(
          localAssignments
            .filter(a => a.shift_definition_id === editCell.shiftId && a.date === editCell.date)
            .map(a => a.employee_id)
        )
        const available = employees.filter(emp => !assignedIds.has(emp.id))
        return createPortal(
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onClick={() => { setEditCell(null); setDropdownPos(null) }} />
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'fixed', top: dropdownPos.top, left: dropdownPos.left,
              zIndex: 9999, background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: '160px', padding: '4px 0',
            }}>
              {available.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af' }}>
                  Toți angajații asignați
                </div>
              ) : available.map(emp => (
                <button key={emp.id}
                  onClick={() => { addAssignment(editCell.shiftId, editCell.date, emp); setDropdownPos(null) }}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '7px 12px', border: 'none',
                    background: 'none', cursor: 'pointer', fontSize: '12px', color: '#111827' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%',
                    background: emp.color || '#6366f1', flexShrink: 0, display: 'inline-block' }} />
                  {emp.name}
                </button>
              ))}
            </div>
          </>,
          document.body
        )
      })()}
      </div>
    )
  }

  // ── View: Employees as rows ─────────────────────────────────────────────────
  return (
    <div style={wrapper}>
      {Nav}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
          <thead>
            <tr>
              <th style={{
                width: '140px', padding: '8px 12px', textAlign: 'left',
                fontSize: '11px', fontWeight: 500, color: '#9ca3af',
                background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                position: 'sticky', left: 0, zIndex: 10,
              }}>Angajat</th>
              {visibleDates.map((date) => (
                <DayHeader key={date} date={date} holiday={holidayMap[date]} />
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={visibleDates.length + 1}
                  style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                  Niciun angajat activ găsit.
                </td>
              </tr>
            ) : employees.map((emp, idx) => {
              const isLast = idx === employees.length - 1
              return (
                <tr key={emp.id}>
                  {/* Employee label */}
                  <td style={{
                    padding: '10px 12px', borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                    borderRight: '1px solid #e5e7eb', background: '#fff',
                    position: 'sticky', left: 0, zIndex: 5, verticalAlign: 'middle',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: emp.color ?? '#e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 600, color: '#fff',
                      }}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px', textTransform: 'capitalize' }}>
                          {emp.experience_level}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Day cells */}
                  {visibleDates.map((date) => {
                    const holiday = holidayMap[date]
                    const dow = parseISO(date).getDay()
                    const isWorking = schedule.working_days?.includes(dow === 0 ? 7 : dow)
                    const shifts = byEmployee[emp.id]?.[date] ?? []
                    return (
                      <td key={date} style={{
                        padding: '5px', verticalAlign: 'top', minWidth: '90px',
                        borderBottom: isLast ? 'none' : '0.5px solid #f0f0f0',
                        borderLeft: '0.5px solid #f0f0f0',
                        background: holiday ? '#fffbeb' : !isWorking ? '#fafafa' : '#fff',
                      }}>
                        {!isWorking ? (
                          <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '14px', color: '#e5e7eb' }}>✕</span>
                          </div>
                        ) : shifts.length === 0 ? (
                          <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#d1d5db' }}>—</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {shifts.map(({ shiftId, shiftName }) => (
                              <NameBadge key={shiftId} label={shiftName} styleIdx={shiftStyleMap[shiftId] ?? 0} />
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

      {Legend}
      {/* ── Violations panel — uncovered shifts ─────────────────────────────── */}
      {violations.length > 0 && (
        <div className="print-hide" style={{
          borderTop: '0.5px solid #fee2e2',
          background: '#fff7f7',
          padding: '10px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px' }}>⚠️</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
              {violations.length} {violations.length === 1 ? 'tură neacoperită' : 'ture neacoperite'}
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>— click pe celulă pentru a adăuga angajați</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {violations.map((v, i) => (
              <span key={i} style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                background: '#fee2e2', color: '#dc2626',
                border: '0.5px solid #fecaca',
              }}>
                {v.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Employee picker portal — renders in document.body to avoid overflow clipping ── */}
      {mounted && editCell && dropdownPos && (() => {
        const assignedIds = new Set(
          localAssignments
            .filter(a => a.shift_definition_id === editCell.shiftId && a.date === editCell.date)
            .map(a => a.employee_id)
        )
        const available = employees.filter(emp => !assignedIds.has(emp.id))
        return createPortal(
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onClick={() => { setEditCell(null); setDropdownPos(null) }} />
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'fixed',
              top: dropdownPos.top, left: dropdownPos.left,
              zIndex: 9999, background: '#fff',
              border: '0.5px solid #e5e7eb', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: '160px', padding: '4px 0',
            }}>
              {available.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af' }}>
                  Toți angajații asignați
                </div>
              ) : available.map(emp => (
                <button key={emp.id}
                  onClick={() => { addAssignment(editCell.shiftId, editCell.date, emp); setDropdownPos(null) }}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '7px 12px', border: 'none',
                    background: 'none', cursor: 'pointer', fontSize: '12px', color: '#111827' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%',
                    background: emp.color || '#6366f1', flexShrink: 0, display: 'inline-block' }} />
                  {emp.name}
                </button>
              ))}
            </div>
          </>,
          document.body
        )
      })()}
    </div>
  )
}