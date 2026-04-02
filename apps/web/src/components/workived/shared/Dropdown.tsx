import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { moduleThemes, colors } from '@/design/tokens'

const t = moduleThemes.attendance

export interface DropdownOption {
  value: string
  label: string
  description?: string
  badge?: string
}

interface DropdownProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  fullWidth?: boolean
  className?: string
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  disabled = false,
  fullWidth = false,
  className = '',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Update menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8, // 8px gap (mt-2)
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isClickInside = 
        (dropdownRef.current && dropdownRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      
      if (!isClickInside) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  // Close dropdown on scroll or resize
  useEffect(() => {
    if (isOpen) {
      const handleScrollOrResize = () => {
        setIsOpen(false)
      }
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true)
        window.removeEventListener('resize', handleScrollOrResize)
      }
    }
  }, [isOpen])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: t.input,
          border: `1px solid ${t.inputBorder}`,
          color: t.text,
          width: fullWidth ? '100%' : 'auto',
          minWidth: fullWidth ? undefined : '200px',
        }}
      >
        <span className={!selectedOption ? 'text-opacity-50' : ''}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: t.textMuted,
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown Menu - Rendered via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed rounded-lg shadow-lg z-[9999] py-1 max-h-60 overflow-y-auto"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuPosition.width}px`,
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: t.text }}>
                        {option.label}
                      </span>
                      {option.badge && (
                        <span
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{ background: `${colors.accent}20`, color: colors.accent }}
                        >
                          {option.badge}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-[11px]" style={{ color: t.textMuted }}>
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={14} style={{ color: colors.accent }} className="flex-shrink-0 mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
