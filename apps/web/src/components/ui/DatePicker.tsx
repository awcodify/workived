import React, { forwardRef, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { colors } from '@/design/tokens'

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean
  errorMessage?: string
  label?: string
  labelStyle?: React.CSSProperties
  containerClassName?: string
  containerStyle?: React.CSSProperties
  'data-testid'?: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}
function formatDate(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
function parseDate(str: string) {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1]!, 10)
  const mo = parseInt(m[2]!, 10) - 1
  const d = parseInt(m[3]!, 10)
  if (mo < 0 || mo > 11 || d < 1 || d > getDaysInMonth(y, mo)) return null
  return { year: y, month: mo, day: d }
}

function splitDate(val: string): [string, string, string] {
  const dateOnly = val.split('T')[0]!
  const parts = dateOnly.split('-')
  return [parts[0] || '', parts[1] || '', parts[2] || '']
}

const segStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: 'inherit',
  padding: 0,
  textAlign: 'center',
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({
    error,
    errorMessage,
    label,
    labelStyle,
    id,
    className = '',
    containerClassName = '',
    containerStyle,
    style,
    disabled,
    value,
    onChange,
    onBlur,
    min,
    max,
    ...props
  }, ref) => {
    const hiddenRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const yearRef = useRef<HTMLInputElement>(null)
    const monthRef = useRef<HTMLInputElement>(null)
    const dayRef = useRef<HTMLInputElement>(null)
    const [open, setOpen] = useState(false)
    const isControlled = value !== undefined

    const [internalValue, setInternalValue] = useState('')
    const displayValue = isControlled ? String(value) : internalValue

    const [yy, mm, dd] = useMemo(() => splitDate(displayValue), [displayValue])
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; direction: 'down' | 'up' } | null>(null)

    React.useImperativeHandle(ref, () => hiddenRef.current!)

    // Calendar view state
    const parsed = useMemo(() => parseDate(displayValue), [displayValue])
    const [viewYear, setViewYear] = useState(() => parsed?.year ?? new Date().getFullYear())
    const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? new Date().getMonth())

    useEffect(() => {
      if (parsed) {
        setViewYear(parsed.year)
        setViewMonth(parsed.month)
      }
    }, [parsed])

    const triggerChange = useCallback((newValue: string) => {
      setInternalValue(newValue)
      const input = hiddenRef.current
      if (!input || !onChange) return
      input.value = newValue
      const event = new Event('change', { bubbles: true })
      Object.defineProperty(event, 'target', { writable: false, value: input })
      onChange(event as unknown as React.ChangeEvent<HTMLInputElement>)
    }, [onChange])

    const buildAndTrigger = useCallback((y: string, m: string, d: string) => {
      if (!y && !m && !d) {
        triggerChange('')
        return
      }
      const combined = [y, m, d].filter(Boolean).join('-')
      triggerChange(combined)
    }, [triggerChange])

    // Segment change handlers
    const handleYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 4)
      buildAndTrigger(v, mm, dd)
      if (v.length === 4) monthRef.current?.focus()
    }, [mm, dd, buildAndTrigger])

    const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 2)
      buildAndTrigger(yy, v, dd)
      if (v.length === 2) dayRef.current?.focus()
    }, [yy, dd, buildAndTrigger])

    const handleDayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 2)
      buildAndTrigger(yy, mm, v)
    }, [yy, mm, buildAndTrigger])

    // Backspace on empty → go to previous segment
    const handleSegKeyDown = useCallback((
      e: React.KeyboardEvent<HTMLInputElement>,
      prevRef: React.RefObject<HTMLInputElement | null> | null,
      nextRef: React.RefObject<HTMLInputElement | null> | null,
    ) => {
      if (e.key === 'Backspace' && e.currentTarget.value === '' && prevRef?.current) {
        e.preventDefault()
        prevRef.current.focus()
      }
      if (e.key === 'ArrowRight' && nextRef?.current) {
        const el = e.currentTarget
        if (el.selectionStart === el.value.length) {
          e.preventDefault()
          nextRef.current.focus()
        }
      }
      if (e.key === 'ArrowLeft' && prevRef?.current) {
        const el = e.currentTarget
        if (el.selectionStart === 0) {
          e.preventDefault()
          prevRef.current.focus()
        }
      }
    }, [])

    const handleDayClick = useCallback((day: number) => {
      const dateStr = formatDate(viewYear, viewMonth, day)
      if (min && dateStr < String(min)) return
      if (max && dateStr > String(max)) return
      triggerChange(dateStr)
      setOpen(false)
      yearRef.current?.focus()
    }, [viewYear, viewMonth, min, max, triggerChange])

    const prevMonth = useCallback(() => {
      setViewMonth(m => {
        if (m === 0) { setViewYear(y => y - 1); return 11 }
        return m - 1
      })
    }, [])
    const nextMonth = useCallback(() => {
      setViewMonth(m => {
        if (m === 11) { setViewYear(y => y + 1); return 0 }
        return m + 1
      })
    }, [])

    // Close on outside click
    useEffect(() => {
      if (!open) return
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Close on Escape
    useEffect(() => {
      if (!open) return
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }, [open])

    // Calculate dropdown position for portal
    useEffect(() => {
      if (!open || !containerRef.current) { setDropdownPos(null); return }
      const rect = containerRef.current.getBoundingClientRect()
      const calendarHeight = 360 // approximate height of calendar dropdown
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const fitsBelow = spaceBelow >= calendarHeight
      if (fitsBelow || spaceBelow >= spaceAbove) {
        setDropdownPos({ top: rect.bottom + 4, left: rect.left, direction: 'down' })
      } else {
        setDropdownPos({ top: rect.top - 4, left: rect.left, direction: 'up' })
      }
    }, [open])

    const inputId = id || `date-picker-${Math.random().toString(36).substr(2, 9)}`

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const today = new Date()
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

    const isDisabledDay = useCallback((day: number) => {
      const d = formatDate(viewYear, viewMonth, day)
      if (min && d < String(min)) return true
      if (max && d > String(max)) return true
      return false
    }, [viewYear, viewMonth, min, max])

    return (
      <div className={containerClassName} ref={containerRef} style={containerStyle}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium mb-1.5"
            style={labelStyle || { color: '#94A3B8' }}
          >
            {label}
          </label>
        )}
        {/* Hidden input for form value / ref */}
        <input
          ref={hiddenRef}
          id={inputId}
          type="hidden"
          value={displayValue}
          disabled={disabled}
          data-testid={props['data-testid']}
          name={props.name}
        />
        <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ color: style?.color }}>
          {/* Segmented input container */}
          <div
            data-testid={props['data-testid'] ? `${props['data-testid']}-segments` : undefined}
            className={`flex items-center w-full px-3 py-2.5 pr-10 text-sm focus-within:outline-none focus-within:ring-2 ${className}`}
            style={style}
            onClick={() => { if (!disabled) yearRef.current?.focus() }}
          >
            <input
              ref={yearRef}
              type="text"
              inputMode="numeric"
              placeholder="YYYY"
              maxLength={4}
              disabled={disabled}
              value={yy}
              onChange={handleYearChange}
              onFocus={() => !disabled && setOpen(true)}
              onBlur={onBlur}
              onKeyDown={(e) => handleSegKeyDown(e, null, monthRef)}
              style={{ ...segStyle, width: '4.5ch' }}
              aria-label="Year"
            />
            <span style={{ color: colors.ink300, userSelect: 'none', padding: '0 1px' }}>-</span>
            <input
              ref={monthRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              maxLength={2}
              disabled={disabled}
              value={mm}
              onChange={handleMonthChange}
              onFocus={() => !disabled && setOpen(true)}
              onBlur={onBlur}
              onKeyDown={(e) => handleSegKeyDown(e, yearRef, dayRef)}
              style={{ ...segStyle, width: '3ch' }}
              aria-label="Month"
            />
            <span style={{ color: colors.ink300, userSelect: 'none', padding: '0 1px' }}>-</span>
            <input
              ref={dayRef}
              type="text"
              inputMode="numeric"
              placeholder="DD"
              maxLength={2}
              disabled={disabled}
              value={dd}
              onChange={handleDayChange}
              onFocus={() => !disabled && setOpen(true)}
              onBlur={onBlur}
              onKeyDown={(e) => handleSegKeyDown(e, monthRef, null)}
              style={{ ...segStyle, width: '3ch' }}
              aria-label="Day"
            />
          </div>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ opacity: 0.6, color: 'inherit' }}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) setOpen(o => !o)
            }}
          >
            <Calendar size={16} />
          </div>

          {/* Calendar dropdown (portal) */}
          {open && !disabled && dropdownPos && createPortal(
            <div
              data-testid="date-picker-calendar"
              style={{
                position: 'fixed',
                top: dropdownPos.direction === 'down' ? dropdownPos.top : undefined,
                bottom: dropdownPos.direction === 'up' ? (window.innerHeight - dropdownPos.top) : undefined,
                left: dropdownPos.left,
                zIndex: 9999,
                background: colors.ink0,
                border: `1px solid ${colors.ink150}`,
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(15,14,19,0.12)',
                width: 280,
                padding: 12,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} style={{ color: colors.ink500 }} />
                </button>
                <span
                  className="text-sm font-semibold select-none"
                  style={{ color: colors.ink900 }}
                >
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} style={{ color: colors.ink500 }} />
                </button>
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div
                    key={d}
                    className="text-center text-xs py-1 select-none"
                    style={{ color: colors.ink300, fontWeight: 500 }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {/* Empty cells for offset */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = formatDate(viewYear, viewMonth, day)
                  const isSelected = dateStr === displayValue
                  const isToday = dateStr === todayStr
                  const isDayDisabled = isDisabledDay(day)

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isDayDisabled}
                      onClick={() => handleDayClick(day)}
                      className="flex items-center justify-center text-xs h-8 w-full rounded-lg transition-colors"
                      style={{
                        color: isDayDisabled
                          ? colors.ink300
                          : isSelected
                            ? '#fff'
                            : isToday
                              ? colors.accent
                              : colors.ink900,
                        background: isSelected
                          ? colors.accent
                          : 'transparent',
                        fontWeight: isToday || isSelected ? 600 : 400,
                        cursor: isDayDisabled ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected && !isDayDisabled) {
                          e.currentTarget.style.background = colors.ink50
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Today shortcut */}
              <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${colors.ink100}` }}>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const todayDate = formatDate(now.getFullYear(), now.getMonth(), now.getDate())
                    if (min && todayDate < String(min)) return
                    if (max && todayDate > String(max)) return
                    setViewYear(now.getFullYear())
                    setViewMonth(now.getMonth())
                    triggerChange(todayDate)
                    setOpen(false)
                  }}
                  className="w-full text-xs py-1.5 rounded-md transition-colors"
                  style={{ color: colors.accent, fontWeight: 600 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = colors.ink50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
        {error && errorMessage && (
          <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
)

DatePicker.displayName = 'DatePicker'
