'use client'

// Custom mini calendar date picker — no external library dependency.
// Features: month navigation, Monday-first weekday grid, today highlight,
// selected date highlight, minDate support (disables dates before given date).
// Closes on outside click. Value is ISO date string (yyyy-MM-dd).
// Used by: schedules/new/page.tsx for start/end date fields.



import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, isToday, parseISO, startOfWeek, endOfWeek } from 'date-fns'

interface DatePickerProps {
  value: string           // ISO date string yyyy-MM-dd
  onChange: (date: string) => void
  label: string
  placeholder?: string
  minDate?: string        // ISO date string
  error?: string
}

export function DatePicker({ value, onChange, label, placeholder = 'Select date', minDate, error }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return startOfMonth(parseISO(value))
    return startOfMonth(new Date())
  })
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = value ? parseISO(value) : null
  const min = minDate ? parseISO(minDate) : null

  // Build calendar grid — full weeks
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Mon
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function selectDay(day: Date) {
    if (min && day < min) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const displayValue = selected ? format(selected, 'd MMM yyyy') : ''

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
        style={{
          border: open ? '1px solid #2563eb' : '0.5px solid #d1d5db',
          background: '#fff',
          color: displayValue ? '#111827' : '#9ca3af',
        }}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar className="w-4 h-4 shrink-0" style={{ color: '#9ca3af' }} />
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Calendar dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            background: '#fff',
            border: '0.5px solid #e5e7eb',
            borderRadius: '12px',
            padding: '12px',
            width: '260px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: '#6b7280' }} />
            </button>
            <span className="text-sm font-medium" style={{ color: '#111827' }}>
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" style={{ color: '#6b7280' }} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d} className="text-center text-xs font-medium" style={{ color: '#9ca3af', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {days.map((day) => {
              const isSelected = selected && isSameDay(day, selected)
              const isCurrentMonth = isSameMonth(day, viewMonth)
              const isDisabled = min ? day < min : false
              const isTodayDate = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={isDisabled}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: isSelected ? 500 : 400,
                    background: isSelected ? '#2563eb' : isTodayDate && !isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isDisabled
                      ? '#d1d5db'
                      : !isCurrentMonth
                      ? '#d1d5db'
                      : isTodayDate
                      ? '#2563eb'
                      : '#111827',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled && isCurrentMonth) {
                      e.currentTarget.style.background = '#f3f4f6'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isTodayDate ? '#eff6ff' : 'transparent'
                    }
                  }}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ borderTop: '0.5px solid #f3f4f6', marginTop: '8px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                if (!min || today >= min) {
                  setViewMonth(startOfMonth(today))
                  onChange(format(today, 'yyyy-MM-dd'))
                  setOpen(false)
                }
              }}
              className="text-xs w-full text-center transition-colors"
              style={{ color: '#2563eb' }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
