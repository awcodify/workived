import React, { forwardRef, useState, useEffect } from 'react'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'

interface DateTimePickerProps {
  value?: string // ISO 8601 datetime string
  onChange?: (value: string) => void
  dateProps?: React.ComponentProps<typeof DatePicker>
  timeProps?: React.ComponentProps<typeof TimePicker>
  label?: string
  error?: boolean
  errorMessage?: string
  containerClassName?: string
  containerStyle?: React.CSSProperties
  disabled?: boolean
}

/**
 * DateTimePicker - Combined date and time picker component
 * 
 * Features:
 * - Separate date and time inputs that combine into ISO 8601 datetime
 * - Time input automatically enabled when date is selected
 * - Opens picker when clicking anywhere on either field
 * - Consistent styling across the app
 * 
 * @example
 * ```tsx
 * <DateTimePicker
 *   label="Due Date & Time"
 *   value={dueDate}
 *   onChange={(isoString) => setDueDate(isoString)}
 *   error={!!errors.due_date}
 *   errorMessage={errors.due_date?.message}
 * />
 * ```
 */
export const DateTimePicker = forwardRef<HTMLDivElement, DateTimePickerProps>(
  ({ 
    value,
    onChange,
    dateProps,
    timeProps,
    label,
    error,
    errorMessage,
    containerClassName = '',
    containerStyle,
    disabled,
  }, ref) => {
    const [dateValue, setDateValue] = useState('')
    const [timeValue, setTimeValue] = useState('')

    // Parse initial value
    useEffect(() => {
      if (value) {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          const isoDate = date.toISOString().split('T')[0]
          const timeStr = date.toTimeString().slice(0, 5) // HH:MM
          if (isoDate) setDateValue(isoDate)
          if (timeStr) setTimeValue(timeStr)
        }
      }
    }, [value])

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value
      setDateValue(newDate)
      
      if (newDate && onChange) {
        // Combine with existing time or default to 00:00
        const combinedDateTime = `${newDate}T${timeValue || '00:00'}:00`
        onChange(combinedDateTime)
      } else if (!newDate) {
        // Clear time when date is cleared
        setTimeValue('')
        onChange?.('')
      }
    }

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value
      setTimeValue(newTime)
      
      if (dateValue && newTime && onChange) {
        const combinedDateTime = `${dateValue}T${newTime}:00`
        onChange(combinedDateTime)
      }
    }

    return (
      <div ref={ref} className={containerClassName}>
        {label && (
          <label
            className="block mb-2 text-sm font-semibold"
            style={containerStyle}
          >
            {label}
          </label>
        )}
        <div className="flex gap-2">
          <DatePicker
            {...dateProps}
            value={dateValue}
            onChange={handleDateChange}
            disabled={disabled}
            error={error}
            className={dateProps?.className}
            containerClassName="flex-1"
          />
          <TimePicker
            {...timeProps}
            value={timeValue}
            onChange={handleTimeChange}
            disabled={disabled || !dateValue}
            className={timeProps?.className}
            containerClassName="w-36"
          />
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

DateTimePicker.displayName = 'DateTimePicker'

