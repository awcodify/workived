import React, { forwardRef, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Clock } from 'lucide-react'
import { colors } from '@/design/tokens'

interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean
  errorMessage?: string
  label?: string
  containerClassName?: string
  containerStyle?: React.CSSProperties
  'data-testid'?: string
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

function splitTime(val: string): [string, string] {
  const parts = val.split(':')
  return [parts[0] || '', parts[1] || '']
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

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({
    error,
    errorMessage,
    label,
    id,
    className = '',
    containerClassName = '',
    containerStyle,
    style,
    disabled,
    value,
    onChange,
    onBlur,
    ...props
  }, ref) => {
    const hiddenRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hourListRef = useRef<HTMLDivElement>(null)
    const minListRef = useRef<HTMLDivElement>(null)
    const hourRef = useRef<HTMLInputElement>(null)
    const minRef = useRef<HTMLInputElement>(null)
    const [open, setOpen] = useState(false)
    const isControlled = value !== undefined

    const [internalValue, setInternalValue] = useState('')
    const displayValue = isControlled ? String(value) : internalValue

    const [hh, mi] = useMemo(() => splitTime(displayValue), [displayValue])

    React.useImperativeHandle(ref, () => hiddenRef.current!)

    const triggerChange = useCallback((newValue: string) => {
      setInternalValue(newValue)
      const input = hiddenRef.current
      if (!input || !onChange) return
      input.value = newValue
      const event = new Event('change', { bubbles: true })
      Object.defineProperty(event, 'target', { writable: false, value: input })
      onChange(event as unknown as React.ChangeEvent<HTMLInputElement>)
    }, [onChange])

    const buildAndTrigger = useCallback((h: string, m: string) => {
      if (!h && !m) {
        triggerChange('')
        return
      }
      const combined = [h, m].filter(Boolean).join(':')
      triggerChange(combined)
    }, [triggerChange])

    const handleHourChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 2)
      buildAndTrigger(v, mi)
      if (v.length === 2) minRef.current?.focus()
    }, [mi, buildAndTrigger])

    const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 2)
      buildAndTrigger(hh, v)
    }, [hh, buildAndTrigger])

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

    const handleHourSlotClick = useCallback((h: string) => {
      buildAndTrigger(h, mi || '00')
      minRef.current?.focus()
    }, [mi, buildAndTrigger])

    const handleMinSlotClick = useCallback((m: string) => {
      buildAndTrigger(hh || '00', m)
      setOpen(false)
    }, [hh, buildAndTrigger])

    // Scroll selected into view when opening
    useEffect(() => {
      if (!open) return
      const scrollTo = (list: HTMLDivElement | null, selected: string, items: string[]) => {
        if (!list) return
        const idx = items.indexOf(selected)
        if (idx >= 0) {
          const item = list.children[idx] as HTMLElement | undefined
          item?.scrollIntoView?.({ block: 'center' })
        }
      }
      scrollTo(hourListRef.current, hh, HOURS)
      scrollTo(minListRef.current, mi, MINUTES)
    }, [open, hh, mi])

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

    const inputId = id || `time-picker-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className={containerClassName} ref={containerRef}>
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-2 text-sm font-semibold"
            style={containerStyle}
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
        <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {/* Segmented input container */}
          <div
            data-testid={props['data-testid'] ? `${props['data-testid']}-segments` : undefined}
            className={`flex items-center w-full px-3 py-2.5 pr-10 text-sm focus-within:outline-none focus-within:ring-2 ${className}`}
            style={style}
            onClick={() => { if (!disabled) hourRef.current?.focus() }}
          >
            <input
              ref={hourRef}
              type="text"
              inputMode="numeric"
              placeholder="HH"
              maxLength={2}
              disabled={disabled}
              value={hh}
              onChange={handleHourChange}
              onFocus={() => !disabled && setOpen(true)}
              onBlur={onBlur}
              onKeyDown={(e) => handleSegKeyDown(e, null, minRef)}
              style={{ ...segStyle, width: '3ch' }}
              aria-label="Hour"
            />
            <span style={{ color: colors.ink300, userSelect: 'none', padding: '0 1px' }}>:</span>
            <input
              ref={minRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              maxLength={2}
              disabled={disabled}
              value={mi}
              onChange={handleMinChange}
              onFocus={() => !disabled && setOpen(true)}
              onBlur={onBlur}
              onKeyDown={(e) => handleSegKeyDown(e, hourRef, null)}
              style={{ ...segStyle, width: '3ch' }}
              aria-label="Minute"
            />
          </div>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ opacity: 0.6 }}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) setOpen(o => !o)
            }}
          >
            <Clock size={16} />
          </div>

          {/* Time dropdown — dual columns */}
          {open && !disabled && (
            <div
              data-testid="time-picker-dropdown"
              className="absolute z-50 mt-1 left-0 right-0 flex"
              style={{
                background: colors.ink0,
                border: `1px solid ${colors.ink150}`,
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(15,14,19,0.12)',
                height: 220,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {/* Hour column */}
              <div
                ref={hourListRef}
                data-testid="time-picker-hours"
                className="flex-1 overflow-y-auto"
                style={{ borderRight: `1px solid ${colors.ink150}`, padding: '4px 0' }}
              >
                <div className="px-2 py-1 text-xs font-semibold" style={{ color: colors.ink500 }}>
                  Hour
                </div>
                {HOURS.map(h => {
                  const isSelected = h === hh
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSlotClick(h)}
                      className="w-full text-center px-2 py-1.5 text-sm transition-colors"
                      style={{
                        color: isSelected ? '#fff' : colors.ink900,
                        background: isSelected ? colors.accent : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = colors.ink50
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
              {/* Minute column */}
              <div
                ref={minListRef}
                data-testid="time-picker-minutes"
                className="flex-1 overflow-y-auto"
                style={{ padding: '4px 0' }}
              >
                <div className="px-2 py-1 text-xs font-semibold" style={{ color: colors.ink500 }}>
                  Min
                </div>
                {MINUTES.map(m => {
                  const isSelected = m === mi
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinSlotClick(m)}
                      className="w-full text-center px-2 py-1.5 text-sm transition-colors"
                      style={{
                        color: isSelected ? '#fff' : colors.ink900,
                        background: isSelected ? colors.accent : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = colors.ink50
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
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

TimePicker.displayName = 'TimePicker'
