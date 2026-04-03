/**
 * EmployeeDropdown - Lazy-loading dropdown for selecting employees
 * Supports infinite scroll and server-side search
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import { moduleThemes, colors } from '@/design/tokens'
import { useInfiniteQuery } from '@tanstack/react-query'
import { employeesApi } from '@/lib/api/employees'
import type { Employee } from '@/types/api'

const t = moduleThemes.attendance

interface EmployeeDropdownProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
  labelStyle?: React.CSSProperties
  excludeEmployeeId?: string // Exclude specific employee (e.g., when editing, exclude self from managers list)
  includeNone?: boolean // Include "No manager" option
  noneLabel?: string
}

export function EmployeeDropdown({
  value,
  onChange,
  placeholder = 'Select employee...',
  label,
  disabled = false,
  fullWidth = false,
  className = '',
  style,
  labelStyle,
  excludeEmployeeId,
  includeNone = true,
  noneLabel = 'No manager',
}: EmployeeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch employees with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['employees', 'dropdown', searchTerm],
    queryFn: ({ pageParam }) =>
      employeesApi.list({
        cursor: pageParam,
        limit: 50,
        search: searchTerm || undefined,
        status: 'active',
      }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.has_more ? lastPage.meta.next_cursor : undefined,
    enabled: isOpen,
  })

  // Flatten all pages into single array
  const allEmployees = data?.pages.flatMap((page) => page.data) ?? []
  
  // Filter out excluded employee
  const employees = excludeEmployeeId
    ? allEmployees.filter((emp) => emp.id !== excludeEmployeeId)
    : allEmployees

  // Find selected employee
  const selectedEmployee = employees.find((emp) => emp.id === value)

  // Update menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = Math.max(280, rect.width) // At least 280px or button width
      const menuMaxHeight = 240 // max-h-60 = 15rem = 240px
      const viewportHeight = window.innerHeight
      const gap = 8 // Gap between button and dropdown
      
      // Calculate horizontal position
      let left = rect.left
      if (left + menuWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - menuWidth - 10)
      }
      
      // Calculate vertical position - prefer below, but flip if not enough space
      let top = rect.bottom + gap
      const spaceBelow = viewportHeight - rect.bottom - gap
      const spaceAbove = rect.top - gap
      
      // If not enough space below but more space above, show above button
      if (spaceBelow < menuMaxHeight && spaceAbove > spaceBelow) {
        top = rect.top - Math.min(menuMaxHeight, spaceAbove) - gap
      }
      
      setMenuPosition({
        top,
        left,
        width: menuWidth,
      })
      
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isClickInside = 
        (dropdownRef.current?.contains(target)) ||
        (menuRef.current?.contains(target))
      
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

  // Infinite scroll detection
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasNextPage || isFetchingNextPage) return

    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const threshold = 50 // Trigger 50px before bottom
    
    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={labelStyle || { color: t.textMuted }}>
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
        style={style || {
          background: t.input,
          border: `1px solid ${t.inputBorder}`,
          color: t.text,
          width: fullWidth ? '100%' : 'auto',
          minWidth: fullWidth ? undefined : '200px',
        }}
      >
        <span className={!selectedEmployee && !value ? 'text-opacity-50' : ''}>
          {selectedEmployee ? selectedEmployee.full_name : value === '' && includeNone ? noneLabel : placeholder}
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
            className="rounded-lg shadow-lg z-[9999] overflow-hidden"
            style={{
              position: 'fixed',
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
                ref={searchInputRef}
                type="text"
                placeholder="Search employees..."
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
            <div 
              ref={listRef}
              className="py-1 max-h-60 overflow-y-auto"
              onScroll={handleScroll}
            >
              {/* "None" option */}
              {includeNone && (
                <button
                  onClick={() => {
                    onChange('')
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-semibold" style={{ color: t.textMuted }}>
                    {noneLabel}
                  </span>
                  {value === '' && (
                    <Check size={14} style={{ color: colors.accent }} />
                  )}
                </button>
              )}

              {/* Loading initial data */}
              {isLoading && (
                <div className="px-4 py-3 text-center text-sm flex items-center justify-center gap-2" style={{ color: t.textMuted }}>
                  <Loader2 size={14} className="animate-spin" />
                  Loading...
                </div>
              )}

              {/* Employee list */}
              {!isLoading && employees.length === 0 && (
                <div className="px-4 py-3 text-center text-sm" style={{ color: t.textMuted }}>
                  No employees found
                </div>
              )}

              {employees.map((employee) => {
                const isSelected = employee.id === value
                return (
                  <button
                    key={employee.id}
                    onClick={() => {
                      onChange(employee.id)
                      setIsOpen(false)
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold" style={{ color: t.text }}>
                          {employee.full_name}
                        </span>
                      </div>
                      {employee.job_title && (
                        <p className="text-[11px] truncate" style={{ color: t.textMuted }}>
                          {employee.job_title}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={14} style={{ color: colors.accent }} className="flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                )
              })}

              {/* Loading more indicator */}
              {isFetchingNextPage && (
                <div className="px-4 py-2 text-center text-xs flex items-center justify-center gap-2" style={{ color: t.textMuted }}>
                  <Loader2 size={12} className="animate-spin" />
                  Loading more...
                </div>
              )}

              {/* End of list indicator */}
              {!isLoading && !hasNextPage && employees.length > 0 && (
                <div className="px-4 py-2 text-center text-xs" style={{ color: t.textMuted }}>
                  {employees.length} employee{employees.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
