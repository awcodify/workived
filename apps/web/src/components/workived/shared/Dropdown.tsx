import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { moduleThemes, colors } from '@/design/tokens'

const defaultTheme = moduleThemes.attendance

export interface DropdownOption {
  value: string
  label: string
  description?: string
  badge?: string
  icon?: LucideIcon
  iconColor?: string
}

export interface DropdownTheme {
  text: string
  textMuted: string
  input: string
  inputBorder: string
  surface: string
  border: string
  hoverBg?: string
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
  style?: React.CSSProperties
  labelStyle?: React.CSSProperties
  theme?: DropdownTheme
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
  style,
  labelStyle,
  theme: themeProp,
}: DropdownProps) {
  const t = themeProp ?? defaultTheme
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Update menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = rect.width // Use actual button width
      
      // Check if menu would overflow right edge
      let left = rect.left
      if (left + menuWidth > window.innerWidth) {
        // Align to right edge of button instead
        left = rect.right - menuWidth
      }
      
      setMenuPosition({
        top: rect.bottom + 8, // 8px gap below button
        left: Math.max(10, left), // Don't go past left edge either
        width: rect.width,
      })

      // Focus search input after dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      // Clear search when closing
      setSearchTerm('')
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

  // Close dropdown on scroll or resize (but not when scrolling inside the dropdown)
  useEffect(() => {
    if (isOpen) {
      const handleScrollOrResize = (e: Event) => {
        // Don't close if scrolling inside the dropdown menu
        if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) {
          return
        }
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

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={labelStyle || { color: t.textMuted }}>
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        data-testid="dropdown-trigger"
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
          ...style, // Merge custom styles after defaults
        }}
      >
        <span className={`flex items-center gap-2 ${!selectedOption ? 'text-opacity-50' : ''}`}>
          {selectedOption?.icon && <selectedOption.icon size={14} style={{ color: selectedOption.iconColor || colors.accent }} />}
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
            className="fixed rounded-lg shadow-lg z-[9999] overflow-hidden"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuPosition.width}px`,
            }}
          >
            {/* Search Input */}
            <div className="px-3 py-2 border-b" style={{ borderColor: t.border }}>
              <input
                data-testid="dropdown-search-input"
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-2"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.text,
                }}
              />
            </div>

            {/* Options List */}
            <div className="py-1 max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 && (
                <div className="px-4 py-3 text-center text-sm" style={{ color: t.textMuted }}>
                  No results found
                </div>
              )}
              {filteredOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  data-testid={`dropdown-option-${option.value}`}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors flex items-start justify-between gap-3"
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.hoverBg ?? 'rgba(0,0,0,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {option.icon && <option.icon size={14} style={{ color: option.iconColor || colors.accent }} />}
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
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
