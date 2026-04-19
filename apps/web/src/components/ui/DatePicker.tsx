import React, { forwardRef, useRef } from 'react'
import { Calendar } from 'lucide-react'

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean
  errorMessage?: string
  label?: string
  containerClassName?: string
  containerStyle?: React.CSSProperties
  'data-testid'?: string
}

/**
 * DatePicker - Reusable date input component
 * 
 * Features:
 * - Opens picker when clicking anywhere on the field
 * - Consistent styling across the app
 * - Supports React Hook Form via forwardRef
 * - Optional label and error states
 * 
 * @example
 * ```tsx
 * <DatePicker
 *   label="Start Date"
 *   {...register('start_date')}
 *   error={!!errors.start_date}
 *   errorMessage={errors.start_date?.message}
 * />
 * ```
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
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
    ...props 
  }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    
    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!)

    const handleContainerClick = () => {
      if (!disabled && inputRef.current) {
        inputRef.current.showPicker?.()
      }
    }

    const inputId = id || `date-picker-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-2 text-sm font-semibold"
            style={containerStyle}
          >
            {label}
          </label>
        )}
        <div
          onClick={handleContainerClick}
          className={`relative cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="date"
            disabled={disabled}
            className={`w-full px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 ${className}`}
            style={{
              ...style,
              colorScheme: 'dark',
            }}
            {...props}
          />
          <div 
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ opacity: 0.6 }}
          >
            <Calendar size={16} />
          </div>
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
